import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import { findOne } from '@/lib/supabase'
import { resolveInvoice } from '@/lib/resolve-invoice'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId: rawOrderId } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Resolve invoice status (verifies with Xendit, renews if expired)
    const resolveResult = await resolveInvoice(rawOrderId)

    // After resolve, use the effective identifier (renewed invoices get a new invoice_number)
    const effectiveId = resolveResult.status === 'pending' && resolveResult.renewed
      ? resolveResult.orderId
      : rawOrderId

    // Look up transaction by invoice_number or xendit_invoice_id (NOT id to avoid UUID errors)
    let transaction = await findOne('transactions', { invoice_number: effectiveId })
    if (!transaction) transaction = await findOne('transactions', { xendit_invoice_id: effectiveId })
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    const requester = await findOne('users', { id: user.id })
    const isAdmin = requester?.role?.toLowerCase() === 'admin'
    if (transaction.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userData = await findOne('users', { id: transaction.user_id })
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const invoiceData = {
      invoiceNumber: effectiveId,
      orderId: effectiveId,
      createdAt: transaction.created_at,
      paidAt: transaction.paid_at ?? null,
      status: resolveResult.status === 'success' ? 'success'
        : resolveResult.status === 'pending' ? 'pending'
        : resolveResult.status === 'expired' ? 'expired'
        : resolveResult.status === 'failed' ? 'failed'
        : transaction.payment_status,

      userName: userData.name ?? userData.email,
      userEmail: userData.email,

      packageId: transaction.package_id,
      packageTitle: transaction.title,
      coins: transaction.coins,
      priceLabel: transaction.price_label,
      amount: transaction.amount ?? 0,
      invoiceUrl: resolveResult.status === 'pending' ? resolveResult.invoiceUrl : null,

      companyName: 'Carubra',
      companyTagline: 'Social Media Management Platform',
      companyEmail: 'support@carubra.id',
      companyWebsite: 'https://carubra.id',
    }

    return NextResponse.json({ invoice: invoiceData })
  } catch (error: any) {
    console.error('[GET /api/member/invoice/:orderId]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
