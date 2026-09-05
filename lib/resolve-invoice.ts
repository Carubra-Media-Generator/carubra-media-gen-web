import { findOne, updateOne, insert } from '@/lib/supabase'
import { logUserActivity, logApiError } from '@/lib/log'

const XENDIT_API = 'https://api.xendit.co/v2/invoices'
const INVOICE_DURATION_MS = 24 * 60 * 60 * 1000

async function getXenditAuthHeaders() {
  const key = process.env.XENDIT_SECRET_KEY
  if (!key) throw new Error('XENDIT_SECRET_KEY not configured')
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${Buffer.from(key + ':').toString('base64')}`,
  }
}

export type ResolveResult =
  | { status: 'pending'; invoiceUrl: string; renewed: boolean; orderId: string }
  | { status: 'success' }
  | { status: 'expired'; message: string }
  | { status: 'failed'; message: string }
  | { status: 'not_found'; message: string }
  | { status: 'error'; message: string }

async function checkXenditStatus(xenditInvoiceId: string): Promise<{ status: string; paidAmount?: number; paidAt?: string; paymentMethod?: string } | null> {
  try {
    const headers = await getXenditAuthHeaders()
    const res = await fetch(`${XENDIT_API}/${xenditInvoiceId}`, { headers })
    if (!res.ok) {
      console.warn('[resolve-invoice] Xendit GET failed:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json()
    return {
      status: data.status?.toUpperCase() ?? '',
      paidAmount: data.paid_amount,
      paidAt: data.paid_at,
      paymentMethod: data.payment_method,
    }
  } catch (err) {
    console.error('[resolve-invoice] Xendit GET error:', err)
    return null
  }
}

function generateInvoiceNumber(): string {
  return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

async function createNewXenditInvoice(transaction: any): Promise<{ invoiceUrl: string; invoiceId: string; invoiceNumber: string } | null> {
  try {
    const userData = await findOne('users', { id: transaction.user_id })
    if (!userData) throw new Error('User not found')

    const pkg = await findOne('membership_packages', { id: transaction.package_id })
    if (!pkg) throw new Error('Package not found')
    if (pkg.is_active === false) throw new Error('Package is no longer active')

    const invoiceNumber = generateInvoiceNumber()
    const pkgTitle = `${pkg.coins} TOKEN`
    const baseUrl = (process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')
    const successUrl = `${baseUrl}/dashboard/payment-success?orderId=${encodeURIComponent(invoiceNumber)}&status=success`
    const failureUrl = `${baseUrl}/dashboard/member?payment=failed&orderId=${encodeURIComponent(invoiceNumber)}`

    const headers = await getXenditAuthHeaders()
    const xenditRes = await fetch(XENDIT_API, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        external_id: invoiceNumber,
        amount: pkg.price,
        description: `Carubra — ${pkg.name} (${pkgTitle})`,
        payer_email: userData.email,
        customer: {
          given_names: userData.name ?? userData.email,
          email: userData.email,
        },
        items: [{
          name: `${pkg.name} — ${pkgTitle}`,
          quantity: 1,
          price: pkg.price,
          category: 'Token',
        }],
        success_redirect_url: successUrl,
        failure_redirect_url: failureUrl,
        currency: 'IDR',
        invoice_duration: 86400,
      }),
    })

    if (!xenditRes.ok) {
      const xenditErr = await xenditRes.json().catch(() => ({}))
      throw new Error(xenditErr.message ?? `Xendit error ${xenditRes.status}`)
    }

    const xenditData = await xenditRes.json()
    return {
      invoiceUrl: xenditData.invoice_url,
      invoiceId: xenditData.id,
      invoiceNumber,
    }
  } catch (err: any) {
    console.error('[resolve-invoice] createNewXenditInvoice error:', err)
    return null
  }
}

async function findTransaction(identifier: string) {
  let tx = await findOne('transactions', { invoice_number: identifier })
  if (!tx) tx = await findOne('transactions', { xendit_invoice_id: identifier })
  return tx
}

export async function resolveInvoice(identifier: string): Promise<ResolveResult> {
  try {
    // 1. Look up transaction by invoice_number, xendit_invoice_id, or id
    const transaction = await findTransaction(identifier)
    if (!transaction) {
      return { status: 'not_found', message: 'Transaction not found' }
    }

    // 2. If already paid/success, no action needed
    const dbStatus = (transaction.payment_status ?? '').toLowerCase()
    if (dbStatus === 'paid') {
      return { status: 'success' }
    }

    // 3. If already expired and no xendit_invoice_id, can't renew
    if (dbStatus === 'expired' && !transaction.xendit_invoice_id) {
      return { status: 'expired', message: 'Invoice has expired' }
    }

    // 4. Check actual Xendit status
    let xenditStatus: string | null = null
    if (transaction.xendit_invoice_id) {
      const result = await checkXenditStatus(transaction.xendit_invoice_id)
      xenditStatus = result?.status ?? null

      // 4a. If Xendit says PAID but DB doesn't know yet — sync it
      if (xenditStatus === 'PAID' || xenditStatus === 'SETTLED') {
        await updateOne('transactions', { id: transaction.id }, {
          payment_status: 'paid',
          paid_at: result?.paidAt ?? new Date().toISOString(),
          payment_method: result?.paymentMethod ?? transaction.payment_method,
          updated_at: new Date().toISOString(),
        })

        // Credit coins
        const userData = await findOne('users', { id: transaction.user_id })
        if (userData) {
          const currentCoins: number = userData.coins ?? 0
          const coinsToAdd: number = transaction.coins_purchased ?? 0
          await updateOne('users', { id: transaction.user_id }, {
            coins: currentCoins + coinsToAdd,
            updated_at: new Date().toISOString(),
          })
        }

        await logUserActivity(transaction.user_id, null, 'payment.completed',
          `Payment completed (resolved): ${identifier}`, {
            identifier,
          }).catch(() => null)

        return { status: 'success' }
      }

      // 4b. If Xendit says EXPIRED or FAILED — update DB
      if (xenditStatus === 'EXPIRED') {
        await updateOne('transactions', { id: transaction.id }, {
          payment_status: 'expired',
          updated_at: new Date().toISOString(),
        })
        // Fall through to renewal
      } else if (xenditStatus === 'FAILED') {
        await updateOne('transactions', { id: transaction.id }, {
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        return { status: 'failed', message: 'Invoice payment failed. Please create a new order.' }
      }

      // 4c. If Xendit says PENDING — invoice is still valid
      if (xenditStatus === 'PENDING') {
        return {
          status: 'pending',
          invoiceUrl: transaction.xendit_payment_url,
          renewed: false,
          orderId: identifier,
        }
      }
    }

    // 5. If we reach here, invoice is expired (either Xendit said EXPIRED or DB says expired or Xendit unreachable but >24h)
    const isStale = transaction.created_at &&
      (Date.now() - new Date(transaction.created_at).getTime()) > INVOICE_DURATION_MS
    const isDbExpired = dbStatus === 'expired'
    const isXenditExpired = xenditStatus === 'EXPIRED'

    if (isDbExpired || isXenditExpired || (isStale && xenditStatus === null)) {
      // Mark as expired in DB if not already
      if (!isDbExpired) {
        await updateOne('transactions', { id: transaction.id }, {
          payment_status: 'expired',
          updated_at: new Date().toISOString(),
        })
      }

      // Try to create a brand NEW invoice (not reusing the old transaction)
      const newInvoice = await createNewXenditInvoice(transaction)
      if (!newInvoice) {
        return {
          status: 'expired',
          message: 'Invoice has expired and we could not create a replacement. Please try again from the dashboard.',
        }
      }

      // Create a NEW transaction row instead of updating the old one
      const newTransaction = await insert('transactions', {
        user_id: transaction.user_id,
        package_id: transaction.package_id,
        coins_purchased: transaction.coins_purchased,
        amount: transaction.amount,
        payment_method: 'xendit',
        payment_status: 'pending',
        xendit_invoice_id: newInvoice.invoiceId,
        xendit_payment_url: newInvoice.invoiceUrl,
        invoice_number: newInvoice.invoiceNumber,
      })

      if (!newTransaction) {
        return {
          status: 'expired',
          message: 'Failed to create new transaction. Please try again from the dashboard.',
        }
      }

      await logUserActivity(transaction.user_id, null, 'payment.renew_invoice',
        `Created new invoice ${newInvoice.invoiceNumber} to replace expired ${identifier}`, {
          oldInvoiceNumber: identifier,
          newInvoiceNumber: newInvoice.invoiceNumber,
          oldTransactionId: transaction.id,
          newTransactionId: newTransaction.id,
        }).catch(() => null)

      return {
        status: 'pending',
        invoiceUrl: newInvoice.invoiceUrl,
        renewed: true,
        orderId: newInvoice.invoiceNumber,
      }
    }

    // 6. Fallback — DB says pending, Xendit unreachable, and not yet stale
    if (dbStatus === 'pending' && transaction.xendit_payment_url) {
      return {
        status: 'pending',
        invoiceUrl: transaction.xendit_payment_url,
        renewed: false,
        orderId: identifier,
      }
    }

    return { status: 'error', message: 'Unable to resolve invoice status' }
  } catch (err: any) {
    console.error('[resolve-invoice] Error:', err)
    await logApiError('/api/payments/resolve-invoice', err.message, 500).catch(() => null)
    return { status: 'error', message: err.message ?? 'Internal error resolving invoice' }
  }
}
