import { publishDueScheduledPosts } from '../lib/socialPublish'

const WORKER_INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS) || 60_000

export function startScheduledPostsWorker(intervalMs = WORKER_INTERVAL_MS) {
  // Only start the worker in non-serverless environments
  if (process.env.VERCEL || process.env.NEXT_RUNTIME === 'edge') {
    console.log('[worker] Skipping setInterval worker — use Vercel Cron Jobs instead (vercel.json)')
    return
  }

  console.log(`[worker] Starting scheduled posts worker (interval: ${intervalMs}ms)`)

  const run = async () => {
    try {
      const result = await publishDueScheduledPosts()
      const total = result.posted + result.failed + (result.partial || 0)
      if (total > 0) {
        console.log(`[worker] Scheduled posts processed: posted=${result.posted} failed=${result.failed} partial=${result.partial || 0}`)
      }
      if (result.errors && result.errors.length > 0) {
        console.error('[worker] Scheduled post errors:', result.errors)
      }
    } catch (error) {
      console.error('[worker] Failed to process scheduled posts:', error)
    }
  }

  setInterval(run, intervalMs)
}
