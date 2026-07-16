import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase'

const DEFAULT_LIMIT = 20

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)))
    const offset = (page - 1) * limit

    const supabase = await getSupabaseAdmin()

    // Fetch only the columns actually needed — avoids transferring large image/video blobs
    // and prevents statement timeouts on the images table
    const [imagesResult, videosResult, generatedContentsResult] = await Promise.allSettled([
      supabase
        .from('images')
        .select('id, user_id, prompt, status, coins_used, image_url, width, height, created_at, updated_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),

      supabase
        .from('videos')
        .select('id, user_id, prompt, status, coins_used, video_url, resolution, aspect_ratio, duration, job_id, created_at, updated_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),

      supabase
        .from('generated_contents')
        .select('id, user_id, title, content, metadata, created_at, updated_at', {
          count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
    ])

    const imagesData =
      imagesResult.status === 'fulfilled' ? (imagesResult.value.data ?? []) : []
    const imagesCount =
      imagesResult.status === 'fulfilled' ? (imagesResult.value.count ?? 0) : 0

    const videosData =
      videosResult.status === 'fulfilled' ? (videosResult.value.data ?? []) : []
    const videosCount =
      videosResult.status === 'fulfilled' ? (videosResult.value.count ?? 0) : 0

    const generatedContentsData =
      generatedContentsResult.status === 'fulfilled'
        ? (generatedContentsResult.value.data ?? [])
        : []
    const generatedContentsCount =
      generatedContentsResult.status === 'fulfilled'
        ? (generatedContentsResult.value.count ?? 0)
        : 0

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

    const total = imagesCount + videosCount + generatedContentsCount

    return NextResponse.json({
      contents: allContents.slice(0, limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    })
  } catch (error: any) {
    console.error('[GET /api/admin/contents]', error)
    return NextResponse.json(
      { error: error.message ?? 'Unable to load contents' },
      { status: 500 }
    )
  }
}
