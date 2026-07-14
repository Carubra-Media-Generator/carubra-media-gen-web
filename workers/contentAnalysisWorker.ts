import { find, updateOne } from '../lib/supabase'
import { getSupabaseAdmin } from '../lib/supabase'

const WORKER_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS) || 10_000
const STALE_CLEANUP_INTERVAL_MS = 60_000
const STALE_THRESHOLD_MS = 5 * 60 * 1000

export function startContentAnalysisWorker(intervalMs = WORKER_INTERVAL_MS) {
  if (process.env.VERCEL || process.env.NEXT_RUNTIME === 'edge') {
    console.log('[worker] Skipping setInterval worker — use Vercel Cron Jobs instead')
    return
  }

  console.log('[worker] Starting content analysis worker')

  setInterval(async () => {
    try {
      const jobs = await find('content_analysis_jobs', { status: 'pending' }, { limit: 1 })
      const doc = jobs?.[0]
      if (!doc) return

      await updateOne('content_analysis_jobs', { id: doc.id }, { status: 'processing', updated_at: new Date() })

      if (!doc.url) {
        console.warn('[worker] Skipping job with missing url', doc.id)
        await updateOne('content_analysis_jobs', { id: doc.id }, { status: 'failed', result: { error: 'Missing url' }, updated_at: new Date() })
        return
      }

      console.log(`[worker] Processing job ${doc.id} url=${doc.url}`)

      try {
        const resp = await fetch(doc.url, { method: 'GET' })
        const text = await resp.text()
        const ogTitle = (text.match(/<meta[^>]*property=(['"])og:title\1[^>]*content=(['"])(.*?)\2[^>]*>/i) || [])[3] || ''
        const ogDesc = (text.match(/<meta[^>]*property=(['"])og:description\1[^>]*content=(['"])(.*?)\2[^>]*>/i) || [])[3] || ''
        const titleMatch = text.match(/<title>([^<]*)<\/title>/i)
        const title = titleMatch ? titleMatch[1].trim() : (ogTitle || '')
        const description = ogDesc || ''
        const imgCount = (text.match(/<img\b[^>]*>/gi) || []).length
        const words = (text.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean)).length

        await updateOne('content_analysis_jobs', { id: doc.id }, {
          status: 'completed',
          result: { title, description, imgCount, words, httpStatus: resp.status, fetchedAt: new Date().toISOString() },
          updated_at: new Date(),
        })
        console.log(`[worker] Completed job ${doc.id}`)
      } catch (err) {
        console.error('[worker] Job failed', err)
        await updateOne('content_analysis_jobs', { id: doc.id }, { status: 'failed', result: { error: String(err) }, updated_at: new Date() })
      }
    } catch (err) {
      console.error('[worker] Error', err)
    }
  }, intervalMs)

  // ── Stale strategy job cleanup ────────────────────────────────────────────
  setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()
      const supabase = await getSupabaseAdmin()
      const { data: staleJobs, error } = await supabase
        .from('content_analysis')
        .select('id')
        .eq('status', 'processing')
        .lt('created_at', cutoff)
        .limit(50)

      if (error) {
        console.error('[worker] Stale cleanup query error', error)
        return
      }

      if (!staleJobs || staleJobs.length === 0) return

      console.log(`[worker] Marking ${staleJobs.length} stale strategy jobs as failed`)
      for (const job of staleJobs) {
        await supabase
          .from('content_analysis')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', job.id)
      }
    } catch (err) {
      console.error('[worker] Stale cleanup error', err)
    }
  }, STALE_CLEANUP_INTERVAL_MS)
}
