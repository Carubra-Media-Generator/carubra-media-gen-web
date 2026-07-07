import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { find } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const contents = await find('generated_contents', {}, { orderBy: 'created_at', ascending: false, limit: 200 })
    return NextResponse.json({ contents })
  } catch (error: any) {
    console.error('[GET /api/admin/contents]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to load contents' }, { status: 500 })
  }
}
