import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { deleteOne, findOne } from '@/lib/supabase'
import { logUserActivity } from '@/lib/log'

export async function DELETE(req: NextRequest, context: any) {
  try {
    const { params } = context
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existingContent = await findOne('generated_contents', { id: params.id })
    await deleteOne('generated_contents', { id: params.id })
    
    if (admin) {
      await logUserActivity(admin.id, admin.email, 'admin.delete_content', `Deleted content: ${existingContent?.title || params.id}`, {
        contentId: params.id,
        deletedContent: existingContent,
      }).catch(() => null)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/contents/[id]]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to delete content' }, { status: 500 })
  }
}
