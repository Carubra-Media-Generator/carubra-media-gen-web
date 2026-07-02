import { findOne, updateOne } from '@/lib/supabase'

export function getImageCoinCost(width: number, height: number): number {
  const maxSide = Math.max(width, height)
  if (maxSide >= 1440) return 3
  if (maxSide >= 1080) return 2
  return 1
}

export function getVideoCoinCost(resolution: unknown): number {
  return resolution === '720p' ? 3 : 2
}

async function getCurrentCoins(userId: string): Promise<number> {
  const user = await findOne('users', { id: userId })
  if (!user) {
    throw new Error('User not found')
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

export async function deductUserCoins(userId: string, amount: number): Promise<number> {
  const currentCoins = await ensureUserHasCoins(userId, amount)
  const nextCoins = currentCoins - amount
  await updateOne('users', { id: userId }, {
    coins: nextCoins,
    updated_at: new Date().toISOString(),
  })
  return nextCoins
}

export async function creditUserCoins(userId: string, amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid coin amount')
  }

  const nextCoins = await getCurrentCoins(userId) + amount
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

  const currentCoins = Number(user.coins ?? 0)
  const nextCoins = currentCoins + amount
  await updateOne('users', { email }, {
    coins: nextCoins,
    updated_at: new Date().toISOString(),
  })
  return nextCoins
}
