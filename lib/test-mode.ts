export const TEST_MODE = process.env.TEST_MODE === 'true'

export interface TestPayload {
  test: true
  timestamp: string
  platform: string
  wouldCall: string
  method: string
  headers: Record<string, string>
  body: string
  tokenInfo: {
    platform: string
    accountId: string
    accountUsername: string
    tokenExpiry: string | null
    hasRefreshToken: boolean
  }
  mediaInfo: {
    type: string | null
    size: number | null
    isDataUrl: boolean
    previewUrl: string
  } | null
}

function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

export function createTestPayload(
  platform: string,
  apiUrl: string,
  method: string,
  body: any,
  connection: any,
  post?: any,
): TestPayload {
  const token = connection?.access_token || ''
  return {
    test: true,
    timestamp: new Date().toISOString(),
    platform,
    wouldCall: apiUrl,
    method,
    headers: {
      Authorization: `Bearer ${token.slice(0, 20)}...`,
      'Content-Type':
        body instanceof URLSearchParams
          ? 'application/x-www-form-urlencoded'
          : typeof body === 'string'
            ? 'application/json'
            : 'application/octet-stream',
    },
    body: typeof body === 'string' ? body : safeStringify(body),
    tokenInfo: {
      platform: connection?.platform || platform,
      accountId: connection?.account_id ? connection.account_id.slice(0, 20) + '...' : 'N/A',
      accountUsername: connection?.account_username || 'N/A',
      tokenExpiry: connection?.token_expiry || null,
      hasRefreshToken: !!connection?.refresh_token,
    },
    mediaInfo: post?.media_url
      ? {
          type: post.media_type || null,
          size: typeof post.media_url === 'string' ? post.media_url.length : null,
          isDataUrl: typeof post.media_url === 'string' && post.media_url.startsWith('data:'),
          previewUrl: (typeof post.media_url === 'string' ? post.media_url.slice(0, 100) : '') + '...',
        }
      : null,
  }
}

export function logTestPublish(payload: TestPayload): void {
  console.log('═══════════════════════════════════════════')
  console.log('🧪 TEST MODE - Would publish to', payload.platform)
  console.log('───────────────────────────────────────────')
  console.log('  API Call:', payload.method, payload.wouldCall)
  console.log('  Account:', payload.tokenInfo.accountUsername)
  console.log('  Token:', payload.tokenInfo.accountId)
  console.log('  Expiry:', payload.tokenInfo.tokenExpiry || 'N/A')
  console.log('  Has Refresh Token:', payload.tokenInfo.hasRefreshToken)
  if (payload.mediaInfo) {
    console.log('  Media Type:', payload.mediaInfo.type)
    console.log('  Media Size:', payload.mediaInfo.size, 'bytes')
    console.log('  Is Data URL:', payload.mediaInfo.isDataUrl)
  }
  console.log('  Body Preview:', payload.body.slice(0, 500))
  console.log('═══════════════════════════════════════════')
}
