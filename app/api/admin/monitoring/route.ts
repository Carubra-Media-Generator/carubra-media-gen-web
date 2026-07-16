import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { find, getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const admin = await getAdminUser(req)
  if (!admin || !isAdminUser(admin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.time('monitoring-endpoint-total')

    const supabase = await getSupabaseAdmin()

    // Wrap each promise to add individual timing logs
    const p1 = (async () => {
      console.time('query-user_activity_logs')
      const res = await find('user_activity_logs', {}, { orderBy: 'created_at', ascending: false, limit: 20 })
      console.timeEnd('query-user_activity_logs')
      return res
    })()

    const p2 = (async () => {
      console.time('query-api_error_logs')
      const res = await find('api_error_logs', {}, { orderBy: 'created_at', ascending: false, limit: 20 })
      console.timeEnd('query-api_error_logs')
      return res
    })()

    const p3 = (async () => {
      console.time('query-ai_usage_logs_recent')
      const res = await find('ai_usage_logs', {}, { orderBy: 'created_at', ascending: false, limit: 20 })
      console.timeEnd('query-ai_usage_logs_recent')
      return res
    })()

    const p4 = (async () => {
      console.time('query-rpc_ai_usage_totals')
      const res = await supabase.rpc('get_ai_usage_totals').maybeSingle()
      console.timeEnd('query-rpc_ai_usage_totals')
      return res
    })()

    // Fetch recent logs for display (limited) + aggregate totals in parallel
    const results = await Promise.allSettled([p1, p2, p3, p4])

    const activities = results[0].status === 'fulfilled' ? results[0].value : []
    const errors = results[1].status === 'fulfilled' ? results[1].value : []
    const usage = results[2].status === 'fulfilled' ? results[2].value : []

    const missingTables = results
      .slice(0, 3)
      .map((result, idx) => {
        if (result.status === 'rejected') {
          const table = ['user_activity_logs', 'api_error_logs', 'ai_usage_logs'][idx]
          const message = result.reason?.message || String(result.reason)
          if (message.includes(table) || message.includes('schema cache')) return table
        }
        return null
      })
      .filter(Boolean)

    // Try to use the RPC aggregate result first, then fall back to COUNT(*) head query,
    // then fall back to the 20-record sample
    let totalEventCount = usage.length
    let totalTokenSum = usage.reduce(
      (sum: number, record: any) => sum + (record.total_tokens ?? 0),
      0
    )

    const rpcResult = results[3]
    if (rpcResult.status === 'fulfilled') {
      const rpcData = (rpcResult.value as any)?.data
      if (rpcData && rpcData.total_events != null) {
        totalEventCount = Number(rpcData.total_events)
        totalTokenSum = Number(rpcData.total_tokens)
      } else {
        // RPC not available — fall back to a count-only query (no row data transferred)
        try {
          const { count } = await supabase
            .from('ai_usage_logs')
            .select('id', { count: 'exact', head: true })
          if (count != null) totalEventCount = count

          // Sum tokens from 20-record sample (already fetched above) as best-effort
          totalTokenSum = usage.reduce(
            (sum: number, record: any) => sum + (record.total_tokens ?? 0),
            0
          )
        } catch {
          // Keep 20-record fallback values
        }
      }
    } else {
      // RPC failed — fall back to count-only query
      try {
        const { count } = await supabase
          .from('ai_usage_logs')
          .select('id', { count: 'exact', head: true })
        if (count != null) totalEventCount = count
      } catch {
        // Keep 20-record fallback values
      }
    }

    const latestUsage = usage[0] ?? null

    console.timeEnd('monitoring-endpoint-total')
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
        successfulRequests: totalEventCount,
        failedRequests: 0,
      },
    })
  } catch (error: any) {
    console.timeEnd('monitoring-endpoint-total')
    return NextResponse.json(
      { error: error.message ?? 'Failed to load monitoring data' },
      { status: 500 }
    )
  }
}
