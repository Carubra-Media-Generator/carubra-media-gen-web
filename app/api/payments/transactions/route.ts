import { NextRequest, NextResponse } from 'next/server'
import { find } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'
import { expireStaleInvoices } from '@/lib/expire-stale'

// Map packageId string → title & priceLabel (karena kolom ini ga ada di DB)
const packageMeta: Record<number, { title: string; priceLabel: string }> = {
  100:  { title: '100 TOKEN',  priceLabel: 'Rp 120.000' },
  250:  { title: '250 TOKEN',  priceLabel: 'Rp 250.000' },
  500:  { title: '500 TOKEN',  priceLabel: 'Rp 450.000' },
  1000: { title: '1000 TOKEN', priceLabel: 'Rp 800.000' },
  2000: { title: '2000 TOKEN', priceLabel: 'Rp 1.500.000' },
}

type TransactionStatus = 'success' | 'pending' | 'failed' | 'expired'

function normalizeStatus(status: string | null): TransactionStatus {
  if (!status) return 'pending'
  const s = status.toLowerCase()
  if (s === 'success' || s === 'paid' || s === 'settled') return 'success'
  if (s === 'pending') return 'pending'
  if (s === 'failed' || s === 'refunded') return 'failed'
  if (s === 'expired') return 'expired'
  return 'pending'
}

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await expireStaleInvoices()

    const rows = await find('transactions', { user_id: user.id }, {
      orderBy: 'created_at',
      ascending: false,
      limit: 50,
    })

    const transactions = (rows ?? []).map((tx: any) => {
      const coins: number = tx.coins_purchased ?? 0
      const meta = packageMeta[coins]
      const amount: number = tx.amount ?? 0

      return {
        id:         tx.id,
        orderId:    tx.invoice_number ?? tx.id,
        packageId:  tx.package_id ?? 'unknown',
        title:      meta?.title ?? `Topup ${coins} TOKEN`,
        coins,
        priceLabel: meta?.priceLabel ?? (amount ? `Rp ${amount.toLocaleString('id-ID')}` : 'Rp 0'),
        status:     normalizeStatus(tx.payment_status),
        invoiceUrl: tx.xendit_payment_url ?? undefined,
        paidAt:     tx.paid_at ? new Date(tx.paid_at).toISOString() : undefined,
        createdAt:  tx.created_at ? new Date(tx.created_at).toISOString() : new Date().toISOString(),
      }
    })

    return NextResponse.json({ transactions })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Unable to load transactions' }, { status: 500 })
  }
}