import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/middleware/auth'
import {
  normalizePlatform,
  getBaseUrl,
  getRedirectUri,
  getOAuthCredentials,
  buildOAuthUrl,
  generateState,
  generateCodeVerifier,
  storeOAuthSession,
} from '@/lib/social-connect'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const paramsData = await params
  let platform: string
  try {
    platform = normalizePlatform(paramsData.platform)
  } catch {
    return NextResponse.json({ error: `Platform ${paramsData.platform} not supported` }, { status: 400 })
  }

  const baseUrl = getBaseUrl(req.nextUrl.origin)
  const redirectUri = getRedirectUri(platform, baseUrl)

  const redirectCheckKey = `${platform.toUpperCase()}_REDIRECT_URI`
  if (!redirectUri) {
    return NextResponse.json({
      error: `${platform} redirect URI not configured. Set ${redirectCheckKey} or ${redirectCheckKey}_VERCEL in .env.`,
    }, { status: 500 })
  }

  const creds = getOAuthCredentials(platform)
  if (!creds) {
    return NextResponse.json({
      error: `${platform} OAuth credentials not configured. Please set the required environment variables.`,
    }, { status: 500 })
  }

  const state = generateState()
  let codeVerifier: string | undefined
  if (platform === 'twitter') {
    codeVerifier = generateCodeVerifier()
  }
  await storeOAuthSession(state, user.id, platform, codeVerifier)

  const url = buildOAuthUrl(platform, redirectUri, state)
  if (!url) {
    return NextResponse.json({ error: `Failed to build OAuth URL for ${platform}` }, { status: 500 })
  }

  return NextResponse.json({ url })
}
