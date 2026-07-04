import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '../../../../middleware/auth'
import { publishDueScheduledPosts } from '../../../../lib/socialPublish'

export async function POST(req: NextRequest) {
  // Support both user-triggered (via dashboard) and cron-triggered (via Vercel Cron)
  const user = getUserFromRequest(req)
  const cronSecret = req.headers.get('x-cron-secret')
  const expectedCronSecret = process.env.CRON_SECRET

  console.log('[scheduled-posts/run] POST received')

  if (cronSecret && expectedCronSecret) {
    if (cronSecret !== expectedCronSecret) {
      return NextResponse.json({ error: 'Invalid cron secret' }, { status: 403 })
    }
    const result = await publishDueScheduledPosts()
    return NextResponse.json(result)
  }

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await publishDueScheduledPosts(user.id)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process scheduled posts' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  const expectedCronSecret = process.env.CRON_SECRET

  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    const result = await publishDueScheduledPosts()
    return NextResponse.json(result)
  }

  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await publishDueScheduledPosts(user.id)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process scheduled posts' }, { status: 500 })
  }
}
