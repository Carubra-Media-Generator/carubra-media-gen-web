import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import { find } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const images = await find('images', { user_id: user.id }, { orderBy: 'created_at', ascending: false })
    const videos = await find('videos', { user_id: user.id }, { orderBy: 'created_at', ascending: false })

    const contents = [
      ...images.filter((doc: any) => doc.status === 'completed').map((doc: any) => ({
        _id: doc.id,
        mediaUrl: doc.image_url,
        mediaType: 'image',
        prompt: doc.prompt,
        caption: doc.caption || '',
        createdAt: doc.created_at,
      })),
      ...videos.filter((doc: any) => doc.status === 'completed').map((doc: any) => ({
        _id: doc.id,
        mediaUrl: doc.video_url,
        mediaType: 'video',
        prompt: doc.prompt,
        caption: doc.caption || '',
        createdAt: doc.created_at,
      }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({ contents })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
