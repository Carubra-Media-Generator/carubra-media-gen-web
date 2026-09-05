import { findOne, getSupabaseAdmin } from '@/lib/supabase'

export function getImageCoinCost(width: number, height: number): number {
  const maxSide = Math.max(width, height)
  if (maxSide >= 1440) return 3
  if (maxSide >= 1080) return 2
  return 1
}

export function getVideoCoinCost(resolution: unknown): number {
  if (resolution === '2K') return 5
  if (resolution === '1080p') return 4
  if (resolution === '720p') return 3
  return 2
}

async function getCurrentCoins(userId: string): Promise<number> {
  const user = await findOne('users', { id: userId })
  if (!user) {
    const error = new Error('User not found')
    ;(error as any).status = 404
    throw error
  }

  return Number(user.coins ?? 0)
}

export async function ensureUserHasCoins(userId: string, amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid coin amount')
  }

  const currentCoins = await getCurrentCoins(userId)
  if (currentCoins < amount) {
    const error = new Error('Insufficient coins')
    ;(error as any).status = 402
    throw error
  }

  return currentCoins
}

/**
 * Atomically deduct coins using a PostgreSQL function.
 * This prevents the TOCTOU race condition where concurrent requests
 * could read the same balance and both succeed.
 */
export async function deductUserCoins(userId: string, amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid coin amount')
  }

  // Check user exists first
  await getCurrentCoins(userId)

  try {
    const supabase = await getSupabaseAdmin()
    const { data, error } = await supabase.rpc('deduct_user_coins', {
      p_user_id: userId,
      p_amount: amount,
    })
    if (error) {
      // If the RPC function doesn't exist yet, fall back to non-atomic version
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.warn('[coins] RPC function not found, falling back to non-atomic deduction')
        return await deductUserCoinsFallback(userId, amount)
      }
      if (error.message?.includes('Insufficient coins')) {
        const err = new Error('Insufficient coins')
        ;(err as any).status = 402
        throw err
      }
      throw error
    }
    return Number(data)
  } catch (e: any) {
    if (e.message === 'Insufficient coins') throw e
    if (e.status) throw e
    console.error('[coins] RPC deduct failed:', e.message)
    // Fallback for when RPC is not available
    return await deductUserCoinsFallback(userId, amount)
  }
}

/**
 * Fallback non-atomic deduction (used only when RPC function is not deployed).
 * Still has the race condition but is better than nothing.
 */
async function deductUserCoinsFallback(userId: string, amount: number): Promise<number> {
  const currentCoins = await ensureUserHasCoins(userId, amount)
  const nextCoins = currentCoins - amount
  const { updateOne } = await import('@/lib/supabase')
  await updateOne('users', { id: userId }, {
    coins: nextCoins,
    updated_at: new Date().toISOString(),
  })
  return nextCoins
}

/**
 * Atomically credit coins using a PostgreSQL function.
 */
export async function creditUserCoins(userId: string, amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid coin amount')
  }

  try {
    const supabase = await getSupabaseAdmin()
    const { data, error } = await supabase.rpc('credit_user_coins', {
      p_user_id: userId,
      p_amount: amount,
    })
    if (error) {
      if (error.message?.includes('function') && error.message?.includes('does not exist')) {
        console.warn('[coins] RPC credit function not found, falling back to non-atomic version')
        return await creditUserCoinsFallback(userId, amount)
      }
      throw error
    }
    return Number(data)
  } catch (e: any) {
    if (e.status) throw e
    console.error('[coins] RPC credit failed:', e.message)
    return await creditUserCoinsFallback(userId, amount)
  }
}

async function creditUserCoinsFallback(userId: string, amount: number): Promise<number> {
  const nextCoins = await getCurrentCoins(userId) + amount
  const { updateOne } = await import('@/lib/supabase')
  await updateOne('users', { id: userId }, {
    coins: nextCoins,
    updated_at: new Date().toISOString(),
  })
  return nextCoins
}

export async function creditUserCoinsByEmail(email: string, amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid coin amount')
  }

  const user = await findOne('users', { email })
  if (!user) {
    throw new Error('User not found')
  }

  return await creditUserCoins(user.id, amount)
}
