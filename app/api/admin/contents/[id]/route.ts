import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { deleteOne, findOne } from '@/lib/supabase'
import { logUserActivity } from '@/lib/log'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check which table the content belongs to
    const image = await findOne('images', { id })
    const video = await findOne('videos', { id })
    const generatedContent = await findOne('generated_contents', { id })

    let deletedFrom = ''
    let deletedItem = null

    if (image) {
      await deleteOne('images', { id })
      deletedFrom = 'images'
      deletedItem = image
    } else if (video) {
      await deleteOne('videos', { id })
      deletedFrom = 'videos'
      deletedItem = video
    } else if (generatedContent) {
      await deleteOne('generated_contents', { id })
      deletedFrom = 'generated_contents'
      deletedItem = generatedContent
    } else {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    if (admin) {
      await logUserActivity(admin.id, admin.email, 'admin.delete_content', `Deleted content from ${deletedFrom}: ${id}`, {
        contentId: id,
        deletedFrom,
        deletedContent: deletedItem,
      }).catch(() => null)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/contents/[id]]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to delete content' }, { status: 500 })
  }
}
