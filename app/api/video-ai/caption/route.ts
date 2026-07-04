import { NextRequest, NextResponse } from 'next/server'
import { findOne, updateOne } from '@/lib/supabase'
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
    let videoRecord = null
    if (videoId) {
      try {
        videoRecord = await findOne('videos', { id: videoId })
      } catch (dbErr) {
        console.error('[video-ai] Failed to fetch video record:', dbErr)
      }
    }

    const sourceImageUrl = videoRecord?.source_image_url || videoRecord?.sourceImageUrl || null

    if (CAPTION_API_KEY && CAPTION_API_URL) {
      try {
        const messages: any[] = [
          {
            role: 'system',
            content: `You are a professional Gen-Z social media manager and short-form video creator specializing in viral TikToks and Instagram Reels.
Your task is to write a highly engaging, catchy, and authentic caption for a short video.

Follow these strict rules:
1. Tone: Sound human, trendy, conversational, and energetic. Avoid generic AI phrases. Write as if you are the creator posting this video.
2. Hook: Start with a strong hook or a relatable question to boost viewer engagement.
3. Structure: Keep it concise (1-3 sentences max). Use line breaks for readability.
4. Language: Match the language of the script/description automatically. If in Indonesian, use natural casual Indonesian (bahasa gaul/santai). If in English, use modern slang/informal English.
5. Emojis & Hashtags: Include 1-3 relevant emojis and 3-5 specific hashtags at the end (e.g. #fyp #reels, and topic-specific hashtags).
6. No templates: Do not use repetitive fallback templates. Each caption must be fully customized and unique.
7. Output: Output ONLY the caption. No conversational filler.`,
          }
        ]

        if (sourceImageUrl) {
          messages.push({
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: sourceImageUrl } },
              {
                type: 'text',
                text: `Write an engaging Reels/TikTok caption for this video. The video is generated from this source image and script: "${script}". Make the caption feel authentic and matching what you see.`,
              }
            ]
          })
        } else {
          messages.push({
            role: 'user',
            content: `Write an engaging Reels/TikTok caption for this video based on this script/description: "${script}". Make the caption feel authentic and trendy.`,
          })
        }

        const response = await fetch(`${CAPTION_API_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${CAPTION_API_KEY}`,
          },
          body: JSON.stringify({
            model: CAPTION_MODEL,
            messages,
            max_tokens: 300,
          }),
        })

        const data = await response.json()
        caption = data?.choices?.[0]?.message?.content ?? ''
        
        if (!caption) {
          caption = generateFallbackCaption(script)
        }
      } catch (apiError) {
        console.error('[video-ai] Caption API failed, using fallback:', apiError)
        caption = generateFallbackCaption(script)
      }
    } else {
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
