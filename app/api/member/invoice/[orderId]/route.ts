import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import { findOne } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId: rawOrderId } = await params
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const orderId = rawOrderId

    // Cari transaksi berdasarkan orderId
    const transaction = await findOne('transactions', { order_id: orderId })
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Pastikan transaksi milik user ini (kecuali admin)
    const requester = await findOne('users', { id: user.id })
    const isAdmin = requester?.role?.toLowerCase() === 'admin'
    if (transaction.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil data user
    const userData = await findOne('users', { id: transaction.user_id })
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const invoiceData = {
      // Invoice meta
      invoiceNumber: `INV-${transaction.order_id}`,
      orderId: transaction.order_id,
      createdAt: transaction.created_at,
      paidAt: transaction.paid_at ?? null,
      status: transaction.status,

      // User info
      userName: userData.name ?? userData.email,
      userEmail: userData.email,

      // Package info
      packageId: transaction.package_id,
      packageTitle: transaction.title,
      coins: transaction.coins,
      priceLabel: transaction.price_label,
      amount: transaction.amount ?? 0, // nominal dalam rupiah

      // Company info (Carubra)
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