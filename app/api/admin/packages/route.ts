import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { find, insert } from '@/lib/supabase'
import { logUserActivity } from '@/lib/log'

export async function GET(req: NextRequest) {
  try {
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const packages = await find('membership_packages', {}, { orderBy: 'created_at', ascending: false, limit: 100 })
    return NextResponse.json({ packages })
  } catch (error: any) {
    console.error('[GET /api/admin/packages]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to load packages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { name, coins, price, description, tag } = body
    if (!name || typeof name !== 'string' || typeof coins !== 'number' || !price || typeof price !== 'string') {
      return NextResponse.json({ error: 'Missing required package fields' }, { status: 400 })
    }

    const pkg = await insert('membership_packages', {
      name,
      coins,
      price,
      description: description ?? null,
      tag: tag ?? null,
    })
    
    if (admin) {
      await logUserActivity(admin.id, admin.email, 'admin.create_package', `Created package: ${name} (${coins} coins, ${price})`, {
        packageId: pkg.id,
        name,
        coins,
        price,
      }).catch(() => null)
    }
    
    return NextResponse.json({ package: pkg })
  } catch (error: any) {
    console.error('[POST /api/admin/packages]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to create package' }, { status: 500 })
  }
}
