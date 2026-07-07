import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAdminUser, isAdminUser } from '@/lib/admin'
import { updateOne, findOne } from '@/lib/supabase'
import { logUserActivity } from '@/lib/log'

export async function PATCH(req: NextRequest, context: any) {
  try {
    const params = await context.params
    const admin = await getAdminUser(req)
    if (!isAdminUser(admin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { role, coins, name, is_banned, password } = await req.json()
    const allowedUpdate: Record<string, any> = {}
    if (typeof role === 'string') allowedUpdate.role = role
    if (typeof coins === 'number') allowedUpdate.coins = coins
    if (typeof name === 'string') allowedUpdate.name = name
    if (typeof is_banned === 'boolean') allowedUpdate.is_banned = is_banned
    if (typeof password === 'string' && password.trim().length > 0) {
      allowedUpdate.password = await bcrypt.hash(password, 10)
    }

    if (Object.keys(allowedUpdate).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const existingUser = await findOne('users', { id: params.id })
    const updatedUser = await updateOne('users', { id: params.id }, allowedUpdate)
    
    if (admin) {
      await logUserActivity(admin.id, admin.email, 'admin.update_user', `Updated user: ${existingUser?.email || params.id}`, {
        targetUserId: params.id,
        targetEmail: existingUser?.email,
        changes: allowedUpdate,
      }).catch(() => null)
    }
    
    return NextResponse.json({ user: updatedUser })
  } catch (error: any) {
    console.error('[PATCH /api/admin/users/[id]]', error)
    return NextResponse.json({ error: error.message ?? 'Unable to update user' }, { status: 500 })
  }
}
