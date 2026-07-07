import { getSupabaseAdmin } from './supabase'

const INVOICE_DURATION_MS = 24 * 60 * 60 * 1000

export async function expireStaleInvoices(): Promise<number> {
  const supabase = await getSupabaseAdmin()
  const cutoff = new Date(Date.now() - INVOICE_DURATION_MS).toISOString()

  const { data, error } = await supabase
    .from('transactions')
    .update({ payment_status: 'expired', updated_at: new Date().toISOString() })
    .eq('payment_status', 'pending')
    .lt('created_at', cutoff)
    .select()

  if (error) {
    console.error('[expireStaleInvoices]', error)
    return 0
  }

  if (data && data.length > 0) {
    console.log(`[expireStaleInvoices] Expired ${data.length} stale invoice(s)`)
  }

  return data?.length ?? 0
}
