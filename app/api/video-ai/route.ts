import { NextRequest, NextResponse } from 'next/server'
import { find } from '@/lib/supabase'
import { getUserFromRequest } from '@/middleware/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const videos = await find('videos', { user_id: user.id }, { orderBy: 'created_at', ascending: false })
    return NextResponse.json({ videos })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
