import { NextRequest, NextResponse } from 'next/server'
import { updateOne } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'

// Fallback caption generator when API is not configured
function generateFallbackCaption(script: string): string {
  const isIndonesian = /[a-zA-Z]/.test(script) && 
    (script.includes('yang') || script.includes('dan') || script.includes('di') || 
     script.includes('untuk') || script.includes('dengan') || script.includes('adalah'))
  
  if (isIndonesian) {
    const indonesianCaptions = [
      `Video yang menginspirasi! ✨ ${script.slice(0, 30)}... #VideoKreatif #Inspirasi #Harian`,
      `Berbagi cerita melalui video ini 🎬 ${script.slice(0, 30)}... #Konten #Eksplorasi #Baru`,
      `Setiap video punya pesan tersendiri 🎥 ${script.slice(0, 30)}... #Kreativitas #Imajinasi #Ekspresi`,
      `Terinspirasi dari ide-ide brilian 💡 ${script.slice(0, 30)}... #Ide #Inovasi #VideoSeni`,
      `Menikmati proses kreatif setiap hari 🚀 ${script.slice(0, 30)}... #Produktif #Semangat #Hidup`,
    ]
    return indonesianCaptions[Math.floor(Math.random() * indonesianCaptions.length)]
  } else {
    const englishCaptions = [
      `Inspiring video content! ✨ ${script.slice(0, 30)}... #CreativeVideo #Inspiration #Daily`,
      `Sharing stories through this video 🎬 ${script.slice(0, 30)}... #Content #Exploration #New`,
      `Every video has its own message 🎥 ${script.slice(0, 30)}... #Creativity #Imagination #Expression`,
      `Inspired by brilliant ideas 💡 ${script.slice(0, 30)}... #Ideas #Innovation #VideoArt`,
      `Enjoying the creative process every day 🚀 ${script.slice(0, 30)}... #Productive #Motivation #Life`,
    ]
    return englishCaptions[Math.floor(Math.random() * englishCaptions.length)]
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { script, videoId } = await req.json()

    const CAPTION_API_KEY = process.env.CAPTION_API_KEY
    const CAPTION_API_URL = process.env.CAPTION_API_URL
    const CAPTION_MODEL   = process.env.CAPTION_MODEL || 'utero/carubra-6.2.1'

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
        caption = data?.choices?.[0]?.message?.content ?? ''
        
        if (!caption) {
          // API returned empty caption, use fallback
          caption = generateFallbackCaption(script)
        }
      } catch (apiError) {
        console.error('[video-ai] Caption API failed, using fallback:', apiError)
        caption = generateFallbackCaption(script)
      }
    } else {
      // API not configured, use fallback
      console.log('[video-ai] Caption API not configured, using fallback generator')
      caption = generateFallbackCaption(script)
    }

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
