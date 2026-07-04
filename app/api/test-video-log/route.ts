import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, find } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseAdmin()
    const { data: videos, error } = await supabase
      .from('videos')
      .select('job_id, status, video_url, id')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) throw error

    return NextResponse.json({ videos })
  } catch (error: any) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
