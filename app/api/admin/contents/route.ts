import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { find } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch from both images and videos tables with individual error handling
    const [images, videos, generatedContents] = await Promise.allSettled([
      find('images', {}, { orderBy: 'created_at', ascending: false, limit: 200 }).catch(() => []),
      find('videos', {}, { orderBy: 'created_at', ascending: false, limit: 200 }).catch(() => []),
      find('generated_contents', {}, { orderBy: 'created_at', ascending: false, limit: 200 }).catch(() => []),
    ])

    const imagesData = images.status === 'fulfilled' ? images.value : []
    const videosData = videos.status === 'fulfilled' ? videos.value : []
    const generatedContentsData = generatedContents.status === 'fulfilled' ? generatedContents.value : []

    // Transform images to unified format
    const transformedImages = imagesData.map((img: any) => ({
      id: img.id,
      user_id: img.user_id,
      title: img.prompt?.slice(0, 100) || 'Generated Image',
      content: img.prompt || '',
      metadata: {
        status: img.status || 'completed',
        content_type: 'image',
        coin_cost: img.coins_used,
        image_url: img.image_url,
        width: img.width,
        height: img.height,
      },
      created_at: img.created_at,
      updated_at: img.updated_at,
    }))

    // Transform videos to unified format
    const transformedVideos = videosData.map((vid: any) => ({
      id: vid.id,
      user_id: vid.user_id,
      title: vid.prompt?.slice(0, 100) || 'Generated Video',
      content: vid.prompt || '',
      metadata: {
        status: vid.status || 'processing',
        content_type: 'video',
        coin_cost: vid.coins_used,
        video_url: vid.video_url,
        resolution: vid.resolution,
        aspect_ratio: vid.aspect_ratio,
        duration: vid.duration,
        job_id: vid.job_id,
      },
      created_at: vid.created_at,
      updated_at: vid.updated_at,
    }))

    // Transform generated_contents to unified format
    const transformedContents = generatedContentsData.map((content: any) => ({
      id: content.id,
      user_id: content.user_id,
      title: content.title || 'Generated Content',
      content: content.content || '',
      metadata: {
        status: content.metadata?.status || 'completed',
        content_type: content.metadata?.content_type || 'legacy',
        coin_cost: content.metadata?.coin_cost,
        ...content.metadata,
      },
      created_at: content.created_at,
      updated_at: content.updated_at,
    }))

    // Combine all contents and sort by created_at
    const allContents = [...transformedImages, ...transformedVideos, ...transformedContents]
    allContents.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA
    })

    return NextResponse.json({ contents: allContents.slice(0, 200) })
  } catch (error: any) {
    console.error('[GET /api/admin/contents]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to load contents' }, { status: 500 })
  }
}
