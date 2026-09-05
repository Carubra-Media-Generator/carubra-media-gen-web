import { NextRequest } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import { findOne } from '@/lib/supabase'

export type AppUser = {
  id: string
  email: string
  name?: string
  role?: string
  coins?: number
}

export function validateUserSchema(user: any): user is AppUser {
  return (
    !!user &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    (user.name === undefined || typeof user.name === 'string') &&
    (user.role === undefined || typeof user.role === 'string') &&
    (user.coins === undefined || typeof user.coins === 'number' || typeof user.coins === 'string')
  )
}

export async function getAdminUser(req: NextRequest): Promise<AppUser | null> {
  const tokenUser = getUserFromRequest(req)
  if (!tokenUser) return null
  const user = await findOne('users', { id: tokenUser.id })
  return validateUserSchema(user) ? user : null
}

export function isAdminUser(user: any): boolean {
  return !!(validateUserSchema(user) && user.role?.toLowerCase().includes('admin'))
}
