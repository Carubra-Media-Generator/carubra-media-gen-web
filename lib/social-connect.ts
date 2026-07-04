import { findOne, insert, updateOne } from './supabase'
import crypto from 'crypto'

export const SUPPORTED_PLATFORMS = ['youtube', 'facebook', 'instagram', 'twitter', 'tiktok', 'threads'] as const
export type Platform = typeof SUPPORTED_PLATFORMS[number]

export function normalizePlatform(platform: string): Platform {
  if (platform === 'x') return 'twitter'
  if (SUPPORTED_PLATFORMS.includes(platform as any)) return platform as Platform
  throw new Error(`Platform ${platform} is not supported`)
}

export function normalizeUri(uri?: string): string | undefined {
  const cleaned = uri?.trim().replace(/\/$/, '')
  return cleaned || undefined
}

export function isConfigured(value?: string): boolean {
  const cleaned = value?.trim()
  return Boolean(cleaned && !/(your_|replace_|dummy|example|changeme)/i.test(cleaned.toLowerCase()))
}

export function isLocalHost(baseUrl: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(baseUrl)
}

export function getBaseUrl(requestOrigin: string): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ||
    process.env.FRONTEND_URL?.replace(/\/$/, '') ||
    requestOrigin
  )
}

export function getRedirectUri(platform: string, baseUrl: string): string {
  const isLocal = isLocalHost(baseUrl)
  const localMap: Record<string, string | undefined> = {
    instagram: normalizeUri(process.env.INSTAGRAM_REDIRECT_URI) || normalizeUri(process.env.IG_REDIRECT_URI),
    youtube: normalizeUri(process.env.YOUTUBE_REDIRECT_URI),
    tiktok: normalizeUri(process.env.TIKTOK_REDIRECT_URI),
    facebook: normalizeUri(process.env.FACEBOOK_REDIRECT_URI) || normalizeUri(process.env.FB_REDIRECT_URI),
    twitter: normalizeUri(process.env.TWITTER_REDIRECT_URI) || normalizeUri(process.env.X_REDIRECT_URI),
    threads: normalizeUri(process.env.THREADS_REDIRECT_URI),
  }
  const prodMap: Record<string, string | undefined> = {
    instagram:
      normalizeUri(process.env.INSTAGRAM_REDIRECT_URI_VERCEL) ||
      normalizeUri(process.env.INSTAGRAM_REDIRECT_URI) ||
      normalizeUri(process.env.IG_REDIRECT_URI),
    youtube:
      normalizeUri(process.env.YOUTUBE_REDIRECT_URI_VERCEL) ||
      normalizeUri(process.env.YOUTUBE_REDIRECT_URI),
    tiktok:
      normalizeUri(process.env.TIKTOK_REDIRECT_URI_VERCEL) ||
      normalizeUri(process.env.TIKTOK_REDIRECT_URI),
    facebook:
      normalizeUri(process.env.FACEBOOK_REDIRECT_URI_VERCEL) ||
      normalizeUri(process.env.FACEBOOK_REDIRECT_URI) ||
      normalizeUri(process.env.FB_REDIRECT_URI),
    twitter:
      normalizeUri(process.env.TWITTER_REDIRECT_URI_VERCEL) ||
      normalizeUri(process.env.TWITTER_REDIRECT_URI) ||
      normalizeUri(process.env.X_REDIRECT_URI),
    threads:
      normalizeUri(process.env.THREADS_REDIRECT_URI_VERCEL) ||
      normalizeUri(process.env.THREADS_REDIRECT_URI),
  }
  return (isLocal ? localMap[platform] : prodMap[platform]) || `${baseUrl}/api/social-connect/${platform}/callback`
}

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url')
}

export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest()
  return Buffer.from(hash).toString('base64url')
}

export async function storeOAuthSession(state: string, userId: string, platform: string, codeVerifier?: string): Promise<void> {
  try {
    await insert('oauth_sessions', {
      state,
      user_id: userId,
      platform,
      code_verifier: codeVerifier || null,
      created_at: new Date().toISOString(),
      expired_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
  } catch (e) {
    console.error('[storeOAuthSession] Failed:', e)
    throw new Error('Failed to store OAuth session')
  }
}

export async function verifyOAuthSession(state: string): Promise<{ userId: string; platform: string; codeVerifier?: string } | null> {
  try {
    const session = await findOne('oauth_sessions', { state })
    if (!session) return null
    const expiredAt = new Date(session.expired_at)
    if (expiredAt < new Date()) return null
    try {
      await updateOne('oauth_sessions', { state }, { expired_at: new Date(0).toISOString() })
    } catch {}
    return {
      userId: session.user_id,
      platform: session.platform,
      codeVerifier: session.code_verifier || undefined,
    }
  } catch {
    return null
  }
}

export function getOAuthCredentials(platform: string): { clientId: string; clientSecret: string } | null {
  const groups: Record<string, [string, string][]> = {
    instagram: [
      ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
      ['FB_APP_ID', 'FB_APP_SECRET'],
    ],
    facebook: [
      ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET'],
      ['FB_APP_ID', 'FB_APP_SECRET'],
    ],
    youtube: [['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']],
    tiktok: [
      ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
      ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_SECRET'],
    ],
    twitter: [
      ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
      ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
    ],
    threads: [['THREADS_CLIENT_ID', 'THREADS_CLIENT_SECRET']],
  }

  const groupList = groups[platform] || []
  for (const [idKey, secretKey] of groupList) {
    const clientId = process.env[idKey]
    const clientSecret = process.env[secretKey]
    if (isConfigured(clientId) && isConfigured(clientSecret)) {
      return { clientId: clientId!, clientSecret: clientSecret! }
    }
  }
  return null
}

export function buildOAuthUrl(platform: string, redirectUri: string, state: string): string | null {
  const creds = getOAuthCredentials(platform)
  if (!creds) return null

  const encodedRedirect = encodeURIComponent(redirectUri)
  const encodedState = encodeURIComponent(state)
  const encodedUserId = encodeURIComponent(state)

  const urls: Record<string, string> = {
    instagram: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${creds.clientId}&redirect_uri=${encodedRedirect}&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement&response_type=code&state=${encodedState}`,
    facebook: `https://www.facebook.com/v18.0/dialog/oauth?client_id=${creds.clientId}&redirect_uri=${encodedRedirect}&scope=pages_show_list,pages_read_engagement,pages_manage_posts&response_type=code&state=${encodedState}`,
    youtube: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${creds.clientId}&redirect_uri=${encodedRedirect}&scope=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.force-ssl')}&response_type=code&access_type=offline&prompt=consent&include_granted_scopes=true&state=${encodedState}`,
    tiktok: `https://www.tiktok.com/auth/authorize/?client_key=${creds.clientId}&scope=user.info.basic,video.upload&response_type=code&redirect_uri=${encodedRedirect}&state=${encodedState}`,
    twitter: buildTwitterOAuthUrl(creds.clientId, redirectUri, state),
    threads: `https://threads.net/oauth/authorize?client_id=${creds.clientId}&redirect_uri=${encodedRedirect}&scope=${encodeURIComponent('threads_basic,threads_content_publish')}&response_type=code&state=${encodedState}`,
  }

  return urls[platform] || null
}

function buildTwitterOAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)
  const encodedRedirect = encodeURIComponent(redirectUri)
  const encodedState = encodeURIComponent(state)
  const scope = encodeURIComponent('tweet.read tweet.write users.read media.write offline.access')
  return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodedRedirect}&scope=${scope}&state=${encodedState}&code_challenge=${challenge}&code_challenge_method=S256&code_verifier=${verifier}`
}
