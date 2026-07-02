import { NextRequest, NextResponse } from 'next/server'
import { find } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'
import { getSignedUrl } from '@/lib/vertex'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const videos = await find('videos', { user_id: user.id }, { orderBy: 'created_at', ascending: false })
    
    // Generate signed URLs for videos with GCS URIs
    const videosWithSignedUrls = await Promise.all(
      videos.map(async (video: any) => {
        if (video.video_url && video.video_url.startsWith('gs://')) {
          try {
            const signedUrl = await getSignedUrl(video.video_url)
            return { ...video, video_url: signedUrl }
          } catch (error) {
            console.error(`[video-ai] Failed to generate signed URL for video ${video.id}:`, error)
            return video
          }
        }
        return video
      })
    )
    
    return NextResponse.json({ videos: videosWithSignedUrls })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
