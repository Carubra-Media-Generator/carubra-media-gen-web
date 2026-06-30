import { NextRequest, NextResponse } from 'next/server'
import { findOne, updateOne } from '@/lib/supabase'
import { creditUserCoins } from '@/lib/coins'
import { getUserFromRequest } from '@/middleware/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params

  const VIDEO_API_KEY = process.env.VIDEO_OPENROUTER_API_KEY || process.env.VIDEO_API_KEY
  const VIDEO_API_URL = process.env.VIDEO_OPENROUTER_URL || process.env.VIDEO_API_URL

  if (!VIDEO_API_KEY || !VIDEO_API_URL) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const baseUrl = VIDEO_API_URL.replace(/\/$/, '')
  let pollUrl = `${baseUrl}/v1/videos/${jobId}`
  if (baseUrl.endsWith('/v1')) {
    pollUrl = `${baseUrl}/videos/${jobId}`
  }

  try {
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${VIDEO_API_KEY}` },
    })
    const pollData = await pollRes.json()

    console.log('[video-ai] COMPLETED FULL DATA:', JSON.stringify(pollData, null, 2))

    if (pollData.status === 'completed') {
      const videoUrl =
        pollData?.unsigned_urls?.[0] ||
        pollData?.data?.[0]?.url     ||
        pollData?.data?.[0]?.uri     ||
        pollData?.videos?.[0]?.uri   ||
        pollData?.videos?.[0]?.url   ||
        pollData?.output?.[0]?.url   ||
        pollData?.videoUrl           ||
        pollData?.url                ||
        null

      try {
        await updateOne(
          'videos',
          { job_id: jobId },
          { status: 'completed', video_url: videoUrl }
        )
      } catch (dbErr) {
        console.error('[video-ai] Failed to update completed status in DB:', dbErr)
      }

      return NextResponse.json({ status: 'completed', videoUrl })
    }

    if (pollData.status === 'failed') {
      try {
        const existingVideo = await findOne('videos', { job_id: jobId })
        await updateOne(
          'videos',
          { job_id: jobId },
          { status: 'failed' }
        )
        if (existingVideo?.user_id === user.id && existingVideo.status !== 'failed' && Number(existingVideo.coins_used ?? 0) > 0) {
          await creditUserCoins(user.id, Number(existingVideo.coins_used))
        }
      } catch (dbErr) {
        console.error('[video-ai] Failed to update failed status in DB:', dbErr)
      }
      return NextResponse.json({ status: 'failed' })
    }

    return NextResponse.json({ status: 'processing' })

  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to check video status', detail: String(error) }, { status: 502 })
  }
}
