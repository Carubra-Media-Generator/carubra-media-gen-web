import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { find } from '@/lib/supabase'
import { logUserActivity } from '@/lib/log'
import { expireStaleInvoices } from '@/lib/expire-stale'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!isAdminUser(admin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  if (admin) {
    await logUserActivity(admin.id, admin.email, 'admin.view_transactions', 'Viewed transactions list', {
      endpoint: '/api/admin/transactions',
    }).catch(() => null)
  }

  try {
    await expireStaleInvoices()

    const [transactions, packages] = await Promise.all([
      find('transactions', {}, { orderBy: 'created_at', ascending: false, limit: 200 }),
      find('membership_packages', {}, { orderBy: 'created_at', ascending: false, limit: 100 }).catch(() => []),
    ])

    const packageMap = new Map((packages ?? []).map((pkg: any) => [pkg.id, pkg.name]))

    const formatted = (transactions ?? []).map((tx: any) => ({
      id: tx.id,
      userId: tx.user_id,
      packageId: tx.package_id,
      packageName: packageMap.get(tx.package_id) ?? tx.package_name ?? 'Paket Tidak Diketahui',
      coins: tx.coins_purchased ?? 0,
      amount: tx.amount ?? 0,
      paymentMethod: tx.payment_method ?? 'manual',
      status: (tx.payment_status ?? 'pending').toLowerCase(),
      invoiceId: tx.invoice_number || tx.xendit_invoice_id || tx.id,
      invoiceUrl: tx.xendit_payment_url || tx.invoice_url || null,
      paidAt: tx.paid_at ? new Date(tx.paid_at).toISOString() : null,
      createdAt: tx.created_at ? new Date(tx.created_at).toISOString() : null,
    }))

    const summary = {
      totalTransactions: formatted.length,
      totalRevenue: formatted.reduce((sum, tx) => sum + Number(tx.amount || 0), 0),
      successCount: formatted.filter(tx => tx.status === 'success' || tx.status === 'paid').length,
      pendingCount: formatted.filter(tx => tx.status === 'pending').length,
      failedCount: formatted.filter(tx => tx.status === 'failed' || tx.status === 'refunded').length,
    }

    return NextResponse.json({ transactions: formatted, summary })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to load transactions' }, { status: 500 })
  }
}
