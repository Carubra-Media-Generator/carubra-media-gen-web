import { NextRequest, NextResponse } from 'next/server'
import { updateOne } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { script, videoId } = await req.json()

    const CAPTION_API_KEY = process.env.CAPTION_API_KEY
    const CAPTION_API_URL = process.env.CAPTION_API_URL
    const CAPTION_MODEL   = process.env.CAPTION_MODEL || 'utero/carubra-6.2.1'

    if (!CAPTION_API_KEY || !CAPTION_API_URL) {
      return NextResponse.json({ error: 'Caption API not configured' }, { status: 500 })
    }

    const response = await fetch(`${CAPTION_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CAPTION_API_KEY}`,
      },
      body: JSON.stringify({
        model: CAPTION_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a social media content writer. Write engaging captions that feel natural and human. Always include relevant emojis and 3-5 hashtags at the end. Match the language of the user\'s description (Indonesian or English). Never copy the description word-for-word. Write as if you are the video creator posting it on TikTok or Instagram Reels.',
          },
          {
            role: 'user',
            content: `Tulis caption media sosial yang menarik dan natural untuk video ini berdasarkan deskripsi: "${script}". Jangan hanya mengulangi deskripsinya. Buat caption yang autentik seperti postingan nyata di TikTok atau Instagram Reels. Sertakan emoji dan 3-5 hashtag relevan.`,
          },
        ],
        max_tokens: 300,
      }),
    })

    const data = await response.json()
    const caption: string = data?.choices?.[0]?.message?.content ?? ''

    if (videoId) {
      try {
        await updateOne(
          'videos',
          { id: videoId },
          { caption }
        )
      } catch (dbError) {
        console.error('[video-ai] Failed to update caption in DB:', dbError)
      }
    }

    return NextResponse.json({ caption })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate caption', detail: String(error) }, { status: 502 })
  }
}
