import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { generateToken } from '@/middleware/auth'
import { findOne, insert } from '@/lib/supabase'
import { logUserActivity, logApiError } from '@/lib/log'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const existingUser = await findOne('users', { email })
    if (existingUser) {
      await logApiError('/api/auth/register', 'Attempted registration for existing user', 409, existingUser.id, existingUser.email).catch(() => null)
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = {
      id: uuidv4(),
      email,
      password: hashedPassword,
      name: name ?? email.split('@')[0],
      role: 'User',
      password_changes_used: 0,
      membership_order: 'B1C2D3E',
      total_created_videos: 0,
      connected_social_accounts: 0,
      coins: 0,
    }

    const savedUser = await insert('users', newUser)
    const token = generateToken({ id: savedUser.id, email: savedUser.email, name: savedUser.name, role: savedUser.role ?? 'User' })
    await logUserActivity(savedUser.id, savedUser.email, 'user.signup', 'New user registered').catch(() => null)

    return NextResponse.json({
      user: {
        id: savedUser.id,
        email: savedUser.email,
        name: savedUser.name,
        phone: savedUser.phone ?? null,
        role: savedUser.role ?? 'User',
        passwordChangesUsed: savedUser.password_changes_used ?? 0,
        membershipOrder: savedUser.membership_order ?? 'B1C2D3E',
        totalCreatedVideos: savedUser.total_created_videos ?? 0,
        connectedSocialAccounts: savedUser.connected_social_accounts ?? 0,
        coins: savedUser.coins ?? 0,
      },
      token,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Register error:', error)
    await logApiError('/api/auth/register', error.message ?? 'Registration failed', 500, null, null).catch(() => null)
    return NextResponse.json({ error: 'Registration failed: ' + error.message }, { status: 500 })
  }
}
