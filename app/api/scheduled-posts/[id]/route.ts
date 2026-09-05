import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import { deleteOne, findOne, updateOne } from '@/lib/supabase'

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    await deleteOne('scheduled_posts', { id, user_id: user.id })
    return NextResponse.json({ message: 'Postingan berhasil dihapus' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const existing = await findOne('scheduled_posts', { id, user_id: user.id })
    if (!existing) {
      return NextResponse.json({ error: 'Postingan tidak ditemukan' }, { status: 404 })
    }
    if (existing.status === 'posted') {
      return NextResponse.json({ error: 'Tidak dapat mengubah postingan yang sudah dipublikasikan' }, { status: 400 })
    }

    const updates = await req.json()
    const allowedFields = [
      'caption', 'media_url', 'media_name', 'media_type',
      'post_types', 'scheduled_date', 'scheduled_time',
      'platforms', 'status', 'media_source',
    ]

    const updateData: any = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field]
      }
    }

    const result = await updateOne('scheduled_posts', { id, user_id: user.id }, updateData)
    return NextResponse.json({ post: toClient(result) })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
