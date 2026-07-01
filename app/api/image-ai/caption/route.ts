import { NextRequest, NextResponse } from 'next/server'
import { updateOne } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { imageUrl, prompt, imageId } = await req.json()

    const CAPTION_API_KEY = process.env.CAPTION_API_KEY
    const CAPTION_API_URL = process.env.CAPTION_API_URL
    const CAPTION_MODEL = process.env.CAPTION_MODEL || 'utero/carubra-6.2.1'

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
            content: 'You are a social media content writer. Write engaging captions that feel natural and human. Always include relevant emojis and 3-5 hashtags at the end. Match the language of the user\'s prompt (if the prompt is in Indonesian, write in Indonesian; if in English, write in English; etc). Never copy the prompt word-for-word. Write as if you are the person who created this content posting it on Instagram or TikTok.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: imageUrl } },
              {
                type: 'text',
                text: `Tulis caption media sosial yang menarik dan natural untuk gambar ini. Prompt asli pengguna: "${prompt}". Jangan hanya mengulangi prompt-nya. Buat caption yang terasa autentik seperti postingan nyata di Instagram.`,
              },
            ],
          },
        ],
        max_tokens: 300,
      }),
    })

    const data = await response.json()
    const caption: string = data?.choices?.[0]?.message?.content ?? ''

    if (imageId) {
      try {
        await updateOne(
          'images',
          { id: imageId },
          { caption }
        )
      } catch (dbError) {
        console.error('[image-ai] Failed to update caption in DB:', dbError)
      }
    }

    return NextResponse.json({ caption })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate caption', detail: String(error) }, { status: 502 })
  }
}
