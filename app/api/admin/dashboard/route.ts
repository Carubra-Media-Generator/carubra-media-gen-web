import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!isAdminUser(admin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await getSupabaseAdmin()

  // Use lightweight aggregate queries — no full row fetches for statistics
  const [usersResult, contentsCountResult] = await Promise.all([
    // Fetch only the columns needed for aggregation (no content/metadata columns)
    supabase
      .from('users')
      .select('role, coins, is_banned, membership_order'),

    // Count generated_contents without fetching any rows
    supabase
      .from('generated_contents')
      .select('id', { count: 'exact', head: true }),
  ])

  const users = usersResult.data ?? []
  const contentCount = contentsCountResult.count ?? 0

  const adminCount = users.filter((u: any) =>
    u.role?.toString().toLowerCase().includes('admin')
  ).length
  const totalCoins = users.reduce(
    (sum: number, u: any) => sum + (Number(u.coins) || 0),
    0
  )
  const bannedCount = users.filter((u: any) => u.is_banned).length
  const membershipCount = users.filter((u: any) => u.membership_order).length

  return NextResponse.json({
    totalUsers: users.length,
    adminCount,
    totalCoins,
    contentCount,
    bannedUsers: bannedCount,
    membershipUsers: membershipCount,
  })
}
