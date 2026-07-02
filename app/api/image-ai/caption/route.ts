import { NextRequest, NextResponse } from 'next/server'
import { updateOne } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'

// Fallback caption generator when API is not configured
function generateFallbackCaption(prompt: string): string {
  const isIndonesian = /[a-zA-Z]/.test(prompt) && 
    (prompt.includes('yang') || prompt.includes('dan') || prompt.includes('di') || 
     prompt.includes('untuk') || prompt.includes('dengan') || prompt.includes('adalah'))
  
  if (isIndonesian) {
    const indonesianCaptions = [
      `Momen yang tak terlupakan! ✨ ${prompt.slice(0, 30)}... #Inspirasi #Harian #Kreativitas`,
      `Berbagi kebahagiaan melalui karya ini 🌟 ${prompt.slice(0, 30)}... #Seni #Eksplorasi #Baru`,
      `Setiap karya punya ceritanya sendiri 🎨 ${prompt.slice(0, 30)}... #Kreativitas #Imajinasi #Ekspresi`,
      `Terinspirasi dari ide-ide brilian 💡 ${prompt.slice(0, 30)}... #Ide #Inovasi #KaryaSeni`,
      `Menikmati proses kreatif setiap hari 🚀 ${prompt.slice(0, 30)}... #Produktif #Semangat #Hidup`,
    ]
    return indonesianCaptions[Math.floor(Math.random() * indonesianCaptions.length)]
  } else {
    const englishCaptions = [
      `Unforgettable moments! ✨ ${prompt.slice(0, 30)}... #Inspiration #Daily #Creativity`,
      `Sharing joy through this creation 🌟 ${prompt.slice(0, 30)}... #Art #Exploration #New`,
      `Every artwork has its own story 🎨 ${prompt.slice(0, 30)}... #Creativity #Imagination #Expression`,
      `Inspired by brilliant ideas 💡 ${prompt.slice(0, 30)}... #Ideas #Innovation #Artwork`,
      `Enjoying the creative process every day 🚀 ${prompt.slice(0, 30)}... #Productive #Motivation #Life`,
    ]
    return englishCaptions[Math.floor(Math.random() * englishCaptions.length)]
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { imageUrl, prompt, imageId } = await req.json()

    const CAPTION_API_KEY = process.env.CAPTION_API_KEY
    const CAPTION_API_URL = process.env.CAPTION_API_URL
    const CAPTION_MODEL = process.env.CAPTION_MODEL || 'utero/carubra-6.2.1'

    let caption: string

    if (CAPTION_API_KEY && CAPTION_API_URL) {
      // Try to use the API if configured
      try {
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
        caption = data?.choices?.[0]?.message?.content ?? ''
        
        if (!caption) {
          // API returned empty caption, use fallback
          caption = generateFallbackCaption(prompt)
        }
      } catch (apiError) {
        console.error('[image-ai] Caption API failed, using fallback:', apiError)
        caption = generateFallbackCaption(prompt)
      }
    } else {
      // API not configured, use fallback
      console.log('[image-ai] Caption API not configured, using fallback generator')
      caption = generateFallbackCaption(prompt)
    }

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
