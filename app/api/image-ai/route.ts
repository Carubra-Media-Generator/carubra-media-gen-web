import { NextRequest, NextResponse } from 'next/server'
import { find } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userImages = await find(
      'images',
      { user_id: user.id },
      { orderBy: 'created_at', ascending: false, limit: 50 }
    )

    // Supabase stores snake_case (image_url), map to camelCase for the client
    const images = (userImages || []).map((img: any) => ({
      ...img,
      imageUrl: img.image_url || img.imageUrl || null,
    }))

    return NextResponse.json({ images })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch images', detail: String(error) }, { status: 500 })
  }
}
