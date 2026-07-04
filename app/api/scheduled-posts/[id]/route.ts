import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import { deleteOne, findOne, updateOne } from '@/lib/supabase'

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
    return NextResponse.json({ post: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
