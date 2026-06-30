import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { insert } from '@/lib/supabase'
import { creditUserCoins, deductUserCoins, ensureUserHasCoins, getVideoCoinCost } from '@/lib/coins'
import { getUserFromRequest } from '@/middleware/auth'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { prompt, style, duration, resolution = '480p' } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const coinsUsed = getVideoCoinCost(resolution)
    try {
      await ensureUserHasCoins(user.id, coinsUsed)
    } catch (coinError: any) {
      return NextResponse.json(
        { error: coinError.message ?? 'Insufficient coins' },
        { status: coinError.status ?? 500 }
      )
    }

    const VIDEO_API_KEY = process.env.VIDEO_OPENROUTER_API_KEY || process.env.VIDEO_API_KEY
    const VIDEO_API_URL = process.env.VIDEO_OPENROUTER_URL || process.env.VIDEO_API_URL
    const VIDEO_MODEL = process.env.VIDEO_OPENROUTER_MODEL || process.env.VIDEO_MODEL || 'carubra/video'

    if (!VIDEO_API_KEY || !VIDEO_API_URL) {
      return NextResponse.json({ error: 'Server is not configured with video generation API credentials' }, { status: 500 })
    }

    const baseUrl = VIDEO_API_URL.replace(/\/$/, '')
    let fetchUrl = `${baseUrl}/v1/videos`
    if (baseUrl.endsWith('/v1')) {
      fetchUrl = `${baseUrl}/videos`
    }

    const newVideo = {
      id: uuidv4(),
      user_id: user.id,
      prompt,
      model: 'text-to-video',
      resolution,
      aspect_ratio: style ? style.replace('-', ':') : '16:9',
      duration,
      coins_used: coinsUsed,
      status: 'processing',
      created_at: new Date(),
    }

    try {
      let response: globalThis.Response
      const headers: Record<string, string> = {
        Authorization: `Bearer ${VIDEO_API_KEY}`,
      }

      headers['Content-Type'] = 'application/json'

      let aspect_ratio: string | undefined = undefined
      if (style) {
        aspect_ratio = style.replace('-', ':') // E.g. '16-9' -> '16:9'
      }

      const body = {
        model: VIDEO_MODEL,
        prompt: prompt,
        ...(aspect_ratio ? { aspect_ratio } : {}),
      }

      console.log(`[video-ai] Calling: ${fetchUrl}`)
      console.log(`[video-ai] Model: ${VIDEO_MODEL}, Prompt: ${prompt}, Aspect Ratio: ${aspect_ratio}`)

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      try {
        response = await fetch(fetchUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      const rawText = await response.text()
      console.log(`[video-ai] Response status: ${response.status}`)
      console.log(`[video-ai] Response body: ${rawText.slice(0, 500)}`)

      let carubraData: any
      try { carubraData = JSON.parse(rawText) } catch { carubraData = rawText }

      if (!response.ok) {
        newVideo.status = 'failed'
        await insert('videos', newVideo)
        return NextResponse.json({ error: 'Video generation failed', detail: carubraData }, { status: response.status })
      }

      const jobId: string | null = carubraData?.id || null
      if (!jobId) {
        newVideo.status = 'failed'
        await insert('videos', newVideo)
        return NextResponse.json({ error: 'No video job ID returned', detail: carubraData }, { status: 502 })
      }

      // Simpan ke DB dengan status processing + jobId
      const finalVideo = {
        ...newVideo,
        job_id: jobId,
        status: 'processing',
      }

      let remainingCoins: number
      try {
        remainingCoins = await deductUserCoins(user.id, coinsUsed)
      } catch (coinError: any) {
        return NextResponse.json(
          { error: coinError.message ?? 'Unable to deduct coins' },
          { status: coinError.status ?? 500 }
        )
      }

      try {
        await insert('videos', finalVideo)
      } catch (dbError) {
        await creditUserCoins(user.id, coinsUsed).catch(() => null)
        throw dbError
      }

      // Return 202
      return NextResponse.json({
        video: {
          id: finalVideo.id,
          jobId,
          status: 'processing',
        },
        coins: remainingCoins,
      }, { status: 202 })

    } catch (error: any) {
      newVideo.status = 'failed'
      console.error('[video-ai] Error:', error)
      try {
        await insert('videos', newVideo)
      } catch {}

      // Detect network / timeout errors and return a clearer message
      const isConnectError =
        error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error?.cause?.code === 'ECONNREFUSED' ||
        error?.name === 'AbortError' ||
        String(error).includes('fetch failed') ||
        String(error).includes('ConnectTimeout')

      if (isConnectError) {
        return NextResponse.json(
          {
            error: 'Video generation server is unreachable',
            detail: `Could not connect to ${fetchUrl}. Please make sure the video server is running and accessible.`,
          },
          { status: 503 },
        )
      }

      return NextResponse.json({ error: 'Failed to call video API', detail: String(error) }, { status: 502 })
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
