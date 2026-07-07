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
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null = null

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
                content: `You are a professional Gen-Z social media manager and content creator specializing in TikTok, Instagram Reels, and viral marketing.
Your goal is to write a highly engaging, authentic, and contextual caption for a post.

Follow these strict rules:
1. Tone: Must sound human, natural, trendy, and slightly witty or conversational. Avoid corporate, dry, or repetitive language. Do not sound like a standard AI. Write as if you are the creator sharing their genuine excitement or thought.
2. Structure: Keep it relatively short and punchy (1-3 sentences max). Use line breaks for readability if needed.
3. Language: Automatically detect and match the language of the prompt/description. If the prompt is in Indonesian, write the entire caption in natural, modern colloquial Indonesian (bahasa santai/gaul, not overly formal). If it is in English, use modern casual English.
4. Emojis: Include 1-3 highly relevant emojis placed naturally (not spammed).
5. Hashtags: Include 3-5 highly relevant, specific hashtags at the very end. Avoid generic tags like #daily #joy; instead, use tags directly related to the actual visual content (e.g. if it's a cat image, use #catsofinstagram #cutepets).
6. Authenticity: Never say "Here is a caption..." or "Prompt:". Output ONLY the final caption itself.
7. Uniqueness: Avoid repetitive phrases or template structures (e.g., do not start with "Momen tak terlupakan" or "Berbagi kebahagiaan").`,
              },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: imageUrl } },
                  {
                    type: 'text',
                    text: `Write an engaging and natural social media caption for this image based on what you actually see. The user's original image generation prompt was: "${prompt}". Do not repeat the prompt. Make the caption feel authentic like a real post on Instagram or TikTok.`,
                  },
                ],
              },
            ],
            max_tokens: 300,
          }),
        })

        const data = await response.json()
        caption = data?.choices?.[0]?.message?.content ?? ''
        usage = data?.usage ?? null
        
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

    return NextResponse.json({ caption, usage })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to generate caption', detail: String(error) }, { status: 502 })
  }
}
