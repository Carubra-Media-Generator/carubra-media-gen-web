import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { find } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await find('users', {}, { orderBy: 'created_at', ascending: false, limit: 200 })
    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('[GET /api/admin/users]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to load users' }, { status: 500 })
  }
}
