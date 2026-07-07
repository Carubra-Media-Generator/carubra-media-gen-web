import { NextRequest, NextResponse } from 'next/server'
import { findOne, updateOne } from '@/lib/supabase'
import { logApiError, logUserActivity } from '@/lib/log'

export async function POST(req: NextRequest) {
  try {
    // ── 1. Verifikasi webhook token ──
    const webhookToken = req.headers.get('x-callback-token')
    const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN
    if (!expectedToken) {
      console.error('[webhook] XENDIT_WEBHOOK_TOKEN not set')
      return NextResponse.json({ error: 'Webhook token not configured' }, { status: 500 })
    }
    if (webhookToken !== expectedToken) {
      console.warn('[webhook] Invalid webhook token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── 2. Parse body Xendit ──
    const body = await req.json()
    const { external_id, status, paid_amount, paid_at, payment_method } = body

    if (!external_id) {
      return NextResponse.json({ error: 'Missing external_id' }, { status: 400 })
    }

    // ── 3. Cari transaksi berdasarkan invoice_number ──
    const transaction = await findOne('transactions', { invoice_number: external_id })
    if (!transaction) {
      console.warn('[webhook] Transaction not found:', external_id)
      return NextResponse.json({ received: true })
    }

    // Skip kalau sudah success (hindari double credit)
    if (transaction.payment_status === 'paid') {
      console.log('[webhook] Already processed:', external_id)
      return NextResponse.json({ received: true })
    }

    // Map status Xendit → status internal
    const statusMap: Record<string, string> = {
      PAID:    'paid',
      SETTLED: 'paid',
      EXPIRED: 'expired',
      FAILED:  'failed',
    }
    const newStatus = statusMap[status?.toUpperCase()]
    if (!newStatus) return NextResponse.json({ received: true })

    // ── 4. Update payment_status di transactions ──
    await updateOne('transactions', { invoice_number: external_id }, {
      payment_status: newStatus,
      paid_at:        newStatus === 'paid' ? (paid_at ?? new Date().toISOString()) : null,
      payment_method: payment_method ?? transaction.payment_method,
      updated_at:     new Date().toISOString(),
    })

    // ── 5. Kalau PAID → kredit coins ke user ──
    if (newStatus === 'paid') {
      const user = await findOne('users', { id: transaction.user_id })
      if (!user) {
        console.error('[webhook] User not found:', transaction.user_id)
        return NextResponse.json({ received: true })
      }

      const currentCoins: number = user.coins ?? 0
      const coinsToAdd: number = transaction.coins_purchased ?? 0

      await updateOne('users', { id: transaction.user_id }, {
        coins: currentCoins + coinsToAdd,
        updated_at: new Date().toISOString(),
      })

      console.log(`[webhook] Sukses! +${coinsToAdd} coins ditambahkan ke user ${transaction.user_id}. Total koin sekarang: ${currentCoins + coinsToAdd}`)
      
      await logUserActivity(transaction.user_id, user.email, 'payment.completed', `Payment completed: ${external_id}`, {
        invoiceNumber: external_id,
        coinsAdded: coinsToAdd,
        previousBalance: currentCoins,
        newBalance: currentCoins + coinsToAdd,
      }).catch(() => null)
    } else if (newStatus === 'expired') {
      await logUserActivity(transaction.user_id, null, 'payment.expired', `Payment expired: ${external_id}`, {
        invoiceNumber: external_id,
      }).catch(() => null)
    } else if (newStatus === 'failed') {
      await logUserActivity(transaction.user_id, null, 'payment.failed', `Payment failed: ${external_id}`, {
        invoiceNumber: external_id,
      }).catch(() => null)
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    console.error('[webhook] Error:', error)
    await logApiError('/api/payments/webhook', error.message, 500).catch(() => null)
    return NextResponse.json({ received: true })
  }
}