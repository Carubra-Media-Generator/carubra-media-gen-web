import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { find, getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdminUser(admin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = await Promise.allSettled([
      find('user_activity_logs', {}, { orderBy: 'created_at', ascending: false, limit: 20 }),
      find('api_error_logs', {}, { orderBy: 'created_at', ascending: false, limit: 20 }),
      find('ai_usage_logs', {}, { orderBy: 'created_at', ascending: false, limit: 20 }),
    ])

    const activities = results[0].status === 'fulfilled' ? results[0].value : []
    const errors = results[1].status === 'fulfilled' ? results[1].value : []
    const usage = results[2].status === 'fulfilled' ? results[2].value : []
    const missingTables = results
      .map((result, idx) => {
        if (result.status === 'rejected') {
          const table = ['user_activity_logs', 'api_error_logs', 'ai_usage_logs'][idx]
          const message = result.reason?.message || String(result.reason)
          if (message.includes(table) || message.includes('schema cache')) return table
        }
        return null
      })
      .filter(Boolean)

    // Get full counts and token sum from all records (not just the 20 most recent)
    let totalEventCount = usage.length
    let totalTokenSum = usage.reduce((sum, record) => sum + (record.total_tokens ?? 0), 0)
    try {
      const supabase = await getSupabaseAdmin()
      const { data: countResult, error: countError } = await supabase
        .from('ai_usage_logs')
        .select('total_tokens')
      if (!countError && countResult) {
        totalEventCount = countResult.length
        totalTokenSum = countResult.reduce((sum, record) => sum + (record.total_tokens ?? 0), 0)
      }
    } catch {
      // Fall back to 20-record count if full query fails
    }

    const latestUsage = usage[0] ?? null

    return NextResponse.json({
      activityLogs: activities,
      errorLogs: errors,
      aiUsageLogs: usage,
      missingTables,
      aiUsageSummary: {
        totalEvents: totalEventCount,
        totalTokens: totalTokenSum,
        latestQuotaRemaining: latestUsage?.quota_remaining ?? null,
        latestUsageAt: latestUsage?.created_at ?? null,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? 'Failed to load monitoring data' }, { status: 500 })
  }
}
