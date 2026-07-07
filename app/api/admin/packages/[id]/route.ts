import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { updateOne, deleteOne, findOne } from '@/lib/supabase'
import { logUserActivity } from '@/lib/log'

export async function PATCH(req: NextRequest, context: any) {
  try {
    const { params } = context
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
    const update: any = {}
    if (typeof name === 'string') update.name = name
    if (typeof coins === 'number') update.coins = coins
    if (typeof price === 'string') update.price = price
    if (description === null || typeof description === 'string') update.description = description
    if (tag === null || typeof tag === 'string') update.tag = tag

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const existingPkg = await findOne('membership_packages', { id: params.id })
    const pkg = await updateOne('membership_packages', { id: params.id }, update)
    
    if (admin) {
      await logUserActivity(admin.id, admin.email, 'admin.update_package', `Updated package: ${existingPkg?.name || params.id}`, {
        packageId: params.id,
        changes: update,
      }).catch(() => null)
    }
    
    return NextResponse.json({ package: pkg })
  } catch (error: any) {
    console.error('[PATCH /api/admin/packages/[id]]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to update package' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const { params } = context
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const existingPkg = await findOne('membership_packages', { id: params.id })
    await deleteOne('membership_packages', { id: params.id })
    
    if (admin) {
      await logUserActivity(admin.id, admin.email, 'admin.delete_package', `Deleted package: ${existingPkg?.name || params.id}`, {
        packageId: params.id,
        deletedPackage: existingPkg,
      }).catch(() => null)
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[DELETE /api/admin/packages/[id]]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to delete package' }, { status: 500 })
  }
}
