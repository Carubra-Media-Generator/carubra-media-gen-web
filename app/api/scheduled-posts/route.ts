import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '../../../middleware/auth'
import { find, insert, uploadToStorage } from '../../../lib/supabase'
import { deductUserCoins, ensureUserHasCoins } from '../../../lib/coins'
import { v4 as uuidv4 } from 'uuid'

function isDataUrl(value: string) {
  return typeof value === 'string' && value.startsWith('data:')
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL format')
  const mimeType = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  return { mimeType, buffer }
}

const toClient = (doc: any) => ({
  id: doc.id,
  _id: doc.id,
  mediaSource: doc.media_source ?? 'upload',
  generatedContentId: doc.generated_video_id ?? doc.generated_image_id ?? null,
  caption: doc.caption ?? '',
  mediaUrl: doc.media_url ?? null,
  mediaName: doc.media_name ?? null,
  mediaType: doc.media_type ?? null,
  postTypes: doc.post_types ?? {},
  date: doc.scheduled_date ?? '',
  time: doc.scheduled_time ?? '',
  scheduledAt: doc.scheduled_date && doc.scheduled_time ? `${doc.scheduled_date}T${doc.scheduled_time}` : null,
  platforms: doc.platforms ?? [],
  status: doc.status ?? 'scheduled',
  createdAt: doc.created_at,
})

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const docs = await find('scheduled_posts', { user_id: user.id }, { orderBy: 'created_at', ascending: false })
    return NextResponse.json({ posts: docs.map(toClient) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const {
      mediaSource, generatedContentId, caption,
      mediaUrl, mediaName, mediaType,
      postTypes, date, time, platforms, status,
    } = await req.json()

    const scheduledAt = date && time ? new Date(`${date}T${time}`).toISOString() : null
    if (scheduledAt && isNaN(Date.parse(scheduledAt))) {
      return NextResponse.json({ error: 'Tanggal dan waktu jadwal tidak valid' }, { status: 400 })
    }

    // Calculate coin cost
    const platformCount = Array.isArray(platforms) ? platforms.length : 0
    let coinCost = platformCount
    if (mediaType === 'image') coinCost += 1
    else if (mediaType === 'video') coinCost += 3

    if (status !== 'draft' && coinCost > 0) {
      try {
        await ensureUserHasCoins(user.id, coinCost)
      } catch (e: any) {
        if (e.status === 402) {
          return NextResponse.json({ error: 'Saldo koin tidak mencukupi. Silakan top up terlebih dahulu.' }, { status: 402 })
        }
        throw e
      }
    }

    let finalMediaUrl = mediaUrl ?? null
    let finalMediaName = mediaName ?? null

    if (mediaSource === 'upload' && typeof mediaUrl === 'string' && isDataUrl(mediaUrl)) {
      const { mimeType, buffer } = parseDataUrl(mediaUrl)
      const ext = mimeType.split('/')[1] || 'bin'
      const fileName = mediaName || `upload-${uuidv4()}.${ext}`
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'public'
      const path = `scheduled_posts/${user.id}/${fileName}`
      const publicUrl = await uploadToStorage(bucket, path, buffer, { contentType: mimeType, cacheControl: '3600' })
      finalMediaUrl = publicUrl
      finalMediaName = fileName
    }

    const doc = {
      id: uuidv4(),
      user_id: user.id,
      media_source: mediaSource === 'generated' ? 'generated' : 'upload',
      generated_video_id: mediaSource === 'generated' && mediaType === 'video' && typeof generatedContentId === 'string' ? generatedContentId : null,
      generated_image_id: mediaSource === 'generated' && mediaType === 'image' && typeof generatedContentId === 'string' ? generatedContentId : null,
      caption: caption ?? '',
      media_url: finalMediaUrl,
      media_name: finalMediaName,
      media_type: ['image', 'video'].includes(mediaType) ? mediaType : null,
      post_types: typeof postTypes === 'object' && postTypes ? postTypes : {},
      scheduled_date: date ?? null,
      scheduled_time: time ?? null,
      platforms: Array.isArray(platforms) ? platforms : [],
      status: status ?? 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const result = await insert('scheduled_posts', doc)

    // Deduct coins after successful creation
    if (status !== 'draft' && coinCost > 0) {
      try {
        await deductUserCoins(user.id, coinCost)
      } catch (e) {
        console.warn('[scheduled-posts] Failed to deduct coins:', e)
      }
    }

    return NextResponse.json({ post: toClient(result) }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
