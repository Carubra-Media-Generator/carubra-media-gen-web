import { getSupabaseAdmin, updateOne } from './supabase'
import { TEST_MODE, createTestPayload, logTestPublish } from './test-mode'

function isDataUrl(value: string) {
  return typeof value === 'string' && value.startsWith('data:')
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/)
  if (!match) throw new Error('Invalid data URL format')
  const mimeType = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  return { mimeType, buffer }
}

async function downloadRemoteFile(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to download remote media: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const mimeType = response.headers.get('content-type') || 'application/octet-stream'
  return { buffer, mimeType }
}

function buildFormDataFile(buffer: Buffer, filename: string, mimeType: string) {
  const blob = new Blob([buffer], { type: mimeType })
  const formData = new FormData()
  formData.append('source', blob, filename)
  return formData
}

async function fetchMediaPayload(post: any) {
  if (!post.media_url) return null
  const isData = isDataUrl(post.media_url)
  if (isData) {
    const { mimeType, buffer } = parseDataUrl(post.media_url)
    return {
      isDataUrl: true,
      buffer,
      mimeType,
      filename: `upload-${post.id}.${mimeType.split('/')[1] || 'bin'}`,
    }
  }

  const { buffer, mimeType } = await downloadRemoteFile(post.media_url)
  return {
    isDataUrl: false,
    buffer,
    mimeType,
    filename: `remote-${post.id}.${mimeType.split('/')[1] || 'bin'}`,
    url: post.media_url,
  }
}

// ─── Token Refresh ─────────────────────────────────────────────────────────────

async function checkTokenExpiry(connection: any): Promise<boolean> {
  if (!connection.token_expiry) return false
  const expiry = new Date(connection.token_expiry)
  return expiry <= new Date()
}

async function refreshFacebookToken(connection: any): Promise<string> {
  const clientId = process.env.FACEBOOK_APP_ID || process.env.FB_APP_ID
  const clientSecret = process.env.FACEBOOK_APP_SECRET || process.env.FB_APP_SECRET
  if (!clientId || !clientSecret) throw new Error('Facebook App credentials not configured for token refresh.')

  const resp = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${connection.access_token}`,
  )
  const data = await resp.json()
  if (!resp.ok || data.error) throw new Error(data.error?.message || 'Failed to refresh Facebook token.')

  const newToken = data.access_token || connection.access_token
  const expiresIn = data.expires_in
  try {
    await updateOne('social_connects', { id: connection.id }, {
      access_token: newToken,
      token_expiry: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[refreshFacebookToken] Failed to persist token:', e)
  }
  return newToken
}

async function getValidFacebookToken(connection: any): Promise<string> {
  if (!(await checkTokenExpiry(connection))) return connection.access_token
  return refreshFacebookToken(connection)
}

async function getValidInstagramToken(connection: any): Promise<string> {
  return getValidFacebookToken(connection)
}

async function refreshGoogleToken(connection: any): Promise<string> {
  const refreshToken = connection.refresh_token
  if (!refreshToken) throw new Error('Google refresh_token is missing. Please reconnect your YouTube account.')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured.')

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await resp.json()
  if (!resp.ok || data.error) throw new Error(data.error_description || data.error || 'Failed to refresh Google token.')

  try {
    await updateOne('social_connects', { id: connection.id }, {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      updated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[refreshGoogleToken] Failed to persist token:', e)
  }
  return data.access_token
}

async function getValidGoogleToken(connection: any): Promise<string> {
  const testResp = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + connection.access_token)
  if (testResp.ok) return connection.access_token
  return refreshGoogleToken(connection)
}

async function refreshTikTokToken(connection: any): Promise<string> {
  const refreshToken = connection.refresh_token
  if (!refreshToken) throw new Error('TikTok refresh_token is missing. Please reconnect your TikTok account.')

  const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET
  if (!clientKey || !clientSecret) throw new Error('TikTok credentials not configured for token refresh.')

  const resp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const data = await resp.json()
  if (!resp.ok || data.error) throw new Error(data.error_description || data.error || 'Failed to refresh TikTok token.')

  const newAccess = data.access_token || data.data?.access_token
  const newRefresh = data.refresh_token || data.data?.refresh_token
  const expiresIn = data.expires_in || data.data?.expires_in

  try {
    await updateOne('social_connects', { id: connection.id }, {
      access_token: newAccess || connection.access_token,
      refresh_token: newRefresh || refreshToken,
      token_expiry: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[refreshTikTokToken] Failed to persist token:', e)
  }
  return newAccess || connection.access_token
}

async function getValidTikTokToken(connection: any): Promise<string> {
  if (!(await checkTokenExpiry(connection))) return connection.access_token
  return refreshTikTokToken(connection)
}

async function refreshTwitterToken(connection: any): Promise<string> {
  const refreshToken = connection.refresh_token
  if (!refreshToken) throw new Error('Twitter refresh_token is missing. Please reconnect your Twitter account.')

  const clientId = process.env.TWITTER_CLIENT_ID || process.env.X_CLIENT_ID
  const clientSecret = process.env.TWITTER_CLIENT_SECRET || process.env.X_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Twitter credentials not configured for token refresh.')

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const resp = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  })
  const data = await resp.json()
  if (!resp.ok || data.error) throw new Error(data.error_description || data.error || 'Failed to refresh Twitter token.')

  try {
    await updateOne('social_connects', { id: connection.id }, {
      access_token: data.access_token || connection.access_token,
      refresh_token: data.refresh_token || refreshToken,
      updated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[refreshTwitterToken] Failed to persist token:', e)
  }
  return data.access_token || connection.access_token
}

async function getValidTwitterToken(connection: any): Promise<string> {
  if (!(await checkTokenExpiry(connection))) return connection.access_token
  return refreshTwitterToken(connection)
}

async function getValidThreadsToken(connection: any): Promise<string> {
  if (!(await checkTokenExpiry(connection))) return connection.access_token
  const clientId = process.env.THREADS_CLIENT_ID
  const clientSecret = process.env.THREADS_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Threads credentials not configured for token refresh.')

  const resp = await fetch('https://graph.threads.net/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: connection.refresh_token,
      access_token: connection.access_token,
    }),
  })
  const data = await resp.json()
  if (!resp.ok || data.error) throw new Error(data.error?.message || 'Failed to refresh Threads token.')

  try {
    await updateOne('social_connects', { id: connection.id }, {
      access_token: data.access_token || connection.access_token,
      refresh_token: data.refresh_token || connection.refresh_token,
      token_expiry: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[getValidThreadsToken] Failed to persist token:', e)
  }
  return data.access_token || connection.access_token
}

// ─── Test Mode Guard ───────────────────────────────────────────────────────────

async function testGuard(platform: string, apiUrl: string, method: string, body: any, connection: any, post?: any): Promise<boolean> {
  if (!TEST_MODE) return false
  const payload = createTestPayload(platform, apiUrl, method, body, connection, post)
  logTestPublish(payload)
  return true
}

// ─── Publishers ────────────────────────────────────────────────────────────────

async function publishFacebook(post: any, connection: any) {
  const accessToken = await getValidFacebookToken(connection)
  const pageId = connection.account_id
  if (!pageId || !accessToken) throw new Error('Facebook page ID or access token missing.')

  if (post.media_type === 'image' && post.media_url) {
    const url = `https://graph.facebook.com/v18.0/${pageId}/photos`
    if (isDataUrl(post.media_url)) {
      const payload = await fetchMediaPayload(post)
      const form = new FormData()
      form.append('access_token', accessToken)
      form.append('caption', post.caption || '')
      form.append('source', new Blob([payload!.buffer], { type: payload!.mimeType }), payload!.filename)
      if (await testGuard('facebook', url, 'POST', form, connection, post)) return
      const resp = await fetch(url, { method: 'POST', body: form })
      const data = await resp.json()
      if (!resp.ok || data.error) throw new Error(data.error?.message || 'Failed to publish Facebook image')
      return
    }

    const body = new URLSearchParams({ access_token: accessToken, caption: post.caption || '', url: post.media_url })
    if (await testGuard('facebook', url, 'POST', body, connection, post)) return
    const resp = await fetch(url, { method: 'POST', body })
    const data = await resp.json()
    if (!resp.ok || data.error) throw new Error(data.error?.message || 'Failed to publish Facebook image')
    return
  }

  if (post.media_type === 'video' && post.media_url) {
    const url = `https://graph.facebook.com/v18.0/${pageId}/videos`
    if (isDataUrl(post.media_url)) {
      const payload = await fetchMediaPayload(post)
      const form = new FormData()
      form.append('access_token', accessToken)
      form.append('description', post.caption || '')
      form.append('source', new Blob([payload!.buffer], { type: payload!.mimeType }), payload!.filename)
      if (await testGuard('facebook', url, 'POST', form, connection, post)) return
      const resp = await fetch(url, { method: 'POST', body: form })
      const data = await resp.json()
      if (!resp.ok || data.error) throw new Error(data.error?.message || 'Failed to publish Facebook video')
      return
    }

    const body = new URLSearchParams({ access_token: accessToken, description: post.caption || '', file_url: post.media_url })
    if (await testGuard('facebook', url, 'POST', body, connection, post)) return
    const resp = await fetch(url, { method: 'POST', body })
    const data = await resp.json()
    if (!resp.ok || data.error) throw new Error(data.error?.message || 'Failed to publish Facebook video')
    return
  }

  const url = `https://graph.facebook.com/v18.0/${pageId}/feed`
  const body = new URLSearchParams({ access_token: accessToken, message: post.caption || ' ' })
  if (await testGuard('facebook', url, 'POST', body, connection, post)) return
  const resp = await fetch(url, { method: 'POST', body })
  const data = await resp.json()
  if (!resp.ok || data.error) throw new Error(data.error?.message || 'Failed to publish Facebook post')
}

async function publishInstagram(post: any, connection: any) {
  const accessToken = await getValidInstagramToken(connection)
  const accountId = connection.account_id
  if (!accountId || !accessToken) throw new Error('Instagram account ID or access token missing.')
  if (!post.media_url) throw new Error('Instagram posting requires an image or video URL.')
  if (isDataUrl(post.media_url)) {
    throw new Error('Instagram publishing requires a publicly accessible media URL. Uploads must be hosted remotely.')
  }
  if (!['image', 'video'].includes(post.media_type)) {
    throw new Error('Instagram publishing currently supports only image or video posts.')
  }

  const igPostType = post.post_types?.instagram || 'feed'

  const containerUrl = `https://graph.facebook.com/v18.0/${accountId}/media`
  const params = new URLSearchParams({ access_token: accessToken, caption: post.caption || '' })

  if (post.media_type === 'image') {
    params.append('image_url', post.media_url)
  } else {
    if (igPostType === 'reels') {
      params.append('media_type', 'REELS')
    } else if (igPostType === 'story') {
      params.append('media_type', 'STORIES')
    }
    params.append('video_url', post.media_url)
  }

  if (await testGuard('instagram', containerUrl, 'POST', params, connection, post)) return
  const containerResp = await fetch(containerUrl, { method: 'POST', body: params })
  const containerData = await containerResp.json()
  if (!containerResp.ok || containerData.error) {
    throw new Error(containerData.error?.message || 'Failed to create Instagram media container')
  }

  const creationId = containerData.id
  if (!creationId) throw new Error('Instagram media container creation failed')

  const publishUrl = `https://graph.facebook.com/v18.0/${accountId}/media_publish`
  const publishBody = new URLSearchParams({ access_token: accessToken, creation_id: creationId })
  if (await testGuard('instagram', publishUrl, 'POST', publishBody, connection, post)) return
  const publishResp = await fetch(publishUrl, { method: 'POST', body: publishBody })
  const publishData = await publishResp.json()
  if (!publishResp.ok || publishData.error) {
    throw new Error(publishData.error?.message || 'Failed to publish Instagram media')
  }
}

async function triggerGowaWebhook(body: any) {
  const webhookUrl = process.env.GOWA_WEBHOOK_URL
  if (!webhookUrl) throw new Error('GOWA_WEBHOOK_URL is not configured.')

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const errorText = await resp.text()
    throw new Error(`Failed to trigger GoWA webhook: ${resp.status} ${resp.statusText} ${errorText}`)
  }

  return resp.json().catch(() => null)
}

async function publishWhatsApp(post: any, connection: any) {
  const clientId = process.env.GOWA_CLIENT_ID
  const phone = connection.account_id
  if (!clientId) throw new Error('GOWA_CLIENT_ID tidak dikonfigurasi.')
  if (!phone) throw new Error('Nomor WhatsApp tidak ditemukan pada koneksi.')

  const payload = {
    source: 'carubra',
    platform: 'whatsapp',
    client_id: clientId,
    phone,
    text: post.caption || '',
    media_url: post.media_url || null,
    media_type: post.media_type || null,
    post_id: post.id,
    user_id: post.user_id,
  }

  if (await testGuard('whatsapp', process.env.GOWA_WEBHOOK_URL || '', 'POST', payload, connection, post)) return
  await triggerGowaWebhook(payload)
}

async function publishYouTube(post: any, connection: any) {
  const accessToken = await getValidGoogleToken(connection)

  if (post.media_type !== 'video' && !post.media_url) {
    throw new Error('YouTube publishing requires a video file.')
  }

  const payload = await fetchMediaPayload(post)
  if (!payload) throw new Error('No media found for YouTube upload.')

  const title = (post.caption || 'Untitled Video').slice(0, 100)
  const description = post.caption || ''

  const postTypes = post.post_types || {}
  const youtubePostType = postTypes.youtube || 'video'

  const metadata: any = {
    snippet: {
      title,
      description,
      categoryId: '22',
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  }

  if (youtubePostType === 'shorts' && !title.toLowerCase().includes('#shorts')) {
    metadata.snippet.title = `${title} #Shorts`.slice(0, 100)
  }

  const initUrl = 'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status'
  if (await testGuard('youtube', initUrl, 'POST', metadata, connection, post)) return

  const initResp = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(payload.buffer.length),
      'X-Upload-Content-Type': payload.mimeType,
    },
    body: JSON.stringify(metadata),
  })

  if (!initResp.ok) {
    const errData = await initResp.json().catch(() => null)
    throw new Error(errData?.error?.message || `YouTube upload init failed: ${initResp.status}`)
  }

  const uploadUrl = initResp.headers.get('location')
  if (!uploadUrl) throw new Error('YouTube did not return an upload URL.')

  if (await testGuard('youtube', uploadUrl, 'PUT', payload.buffer, connection, post)) return
  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': payload.mimeType,
      'Content-Length': String(payload.buffer.length),
    },
    body: payload.buffer,
  })

  if (!uploadResp.ok) {
    const errData = await uploadResp.json().catch(() => null)
    throw new Error(errData?.error?.message || `YouTube video upload failed: ${uploadResp.status}`)
  }

  const videoData = await uploadResp.json()
  console.log('[publishYouTube] Video uploaded successfully. Video ID:', videoData.id)
}

async function publishTikTok(post: any, connection: any) {
  const accessToken = await getValidTikTokToken(connection)
  if (!accessToken) throw new Error('TikTok access token is missing.')

  if (post.media_type !== 'video') {
    throw new Error('TikTok publishing currently supports only video posts.')
  }

  const payload = await fetchMediaPayload(post)
  if (!payload) throw new Error('No media found for TikTok upload.')

  const caption = (post.caption || '').slice(0, 2200)

  const initUrl = 'https://open.tiktokapis.com/v2/post/publish/video/init/'
  const initBody = {
    post_info: {
      title: caption,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: payload.buffer.length,
      chunk_size: payload.buffer.length,
      total_chunk_count: 1,
    },
  }

  if (await testGuard('tiktok', initUrl, 'POST', initBody, connection, post)) return

  const initResp = await fetch(initUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(initBody),
  })

  const initData = await initResp.json()
  if (!initResp.ok || initData.error?.code) {
    throw new Error(initData.error?.message || initData.error?.log_id || `TikTok upload init failed: ${initResp.status}`)
  }

  const uploadUrl = initData.data?.upload_url
  if (!uploadUrl) throw new Error('TikTok did not return an upload URL.')

  if (await testGuard('tiktok', uploadUrl, 'PUT', payload.buffer, connection, post)) return
  const uploadResp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': payload.mimeType,
      'Content-Range': `bytes 0-${payload.buffer.length - 1}/${payload.buffer.length}`,
      'Content-Length': String(payload.buffer.length),
    },
    body: payload.buffer,
  })

  if (!uploadResp.ok) {
    const errText = await uploadResp.text().catch(() => '')
    throw new Error(`TikTok video upload failed: ${uploadResp.status} ${errText}`)
  }

  console.log('[publishTikTok] Video uploaded successfully. Publish ID:', initData.data?.publish_id)
}

async function uploadTwitterMedia(buffer: Buffer, mimeType: string, accessToken: string): Promise<string> {
  const totalBytes = buffer.length
  const mediaCategory = mimeType.startsWith('video') ? 'tweet_video' : 'tweet_image'

  const initParams = new URLSearchParams({
    command: 'INIT',
    total_bytes: String(totalBytes),
    media_type: mimeType,
    media_category: mediaCategory,
  })

  const safeJson = async (resp: Response) => {
    const text = await resp.text()
    try {
      return text ? JSON.parse(text) : {}
    } catch {
      return { error: { message: text || `HTTP ${resp.status}` } }
    }
  }

  const initResp = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'CarubraMediaGenerator/1.0',
    },
    body: initParams,
  })

  const initData = await safeJson(initResp)
  if (!initResp.ok || !initData.media_id_string) {
    throw new Error(initData.error?.message || initData.error || `Twitter media INIT failed: ${initResp.status}`)
  }

  const mediaId = initData.media_id_string

  const chunkSize = 5 * 1024 * 1024
  let segmentIndex = 0
  for (let offset = 0; offset < totalBytes; offset += chunkSize) {
    const chunk = buffer.subarray(offset, Math.min(offset + chunkSize, totalBytes))
    const form = new FormData()
    form.append('command', 'APPEND')
    form.append('media_id', mediaId)
    form.append('segment_index', String(segmentIndex))
    form.append('media_data', new Blob([chunk]))

    const appendResp = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'CarubraMediaGenerator/1.0',
      },
      body: form,
    })

    if (!appendResp.ok) {
      const errText = await appendResp.text()
      throw new Error(`Twitter media APPEND failed at segment ${segmentIndex}: ${appendResp.status} - ${errText}`)
    }
    segmentIndex++
  }

  const finalizeParams = new URLSearchParams({ command: 'FINALIZE', media_id: mediaId })
  const finalizeResp = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'CarubraMediaGenerator/1.0',
    },
    body: finalizeParams,
  })

  const finalizeData = await safeJson(finalizeResp)
  if (!finalizeResp.ok) {
    throw new Error(finalizeData.error?.message || `Twitter media FINALIZE failed: ${finalizeResp.status}`)
  }

  if (finalizeData.processing_info) {
    let processingInfo = finalizeData.processing_info
    while (processingInfo && processingInfo.state !== 'succeeded') {
      if (processingInfo.state === 'failed') {
        throw new Error(`Twitter media processing failed: ${processingInfo.error?.message || 'Unknown error'}`)
      }
      const waitSeconds = processingInfo.check_after_secs || 5
      await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))

      const statusResp = await fetch(
        `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'CarubraMediaGenerator/1.0',
          },
        },
      )
      const statusData = await safeJson(statusResp)
      processingInfo = statusData.processing_info
    }
  }

  return mediaId
}

async function publishTwitter(post: any, connection: any) {
  const accessToken = await getValidTwitterToken(connection)
  if (!accessToken) throw new Error('Twitter access token is missing.')

  const tweetBody: any = {}
  if (post.caption) tweetBody.text = post.caption

  if (post.media_url) {
    const payload = await fetchMediaPayload(post)
    if (payload) {
      const mediaId = await uploadTwitterMedia(payload.buffer, payload.mimeType, accessToken)
      tweetBody.media = { media_ids: [mediaId] }
    }
  }

  const tweetUrl = 'https://api.twitter.com/2/tweets'
  if (await testGuard('twitter', tweetUrl, 'POST', tweetBody, connection, post)) return

  const tweetResp = await fetch(tweetUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'CarubraMediaGenerator/1.0',
    },
    body: JSON.stringify(tweetBody),
  })

  const text = await tweetResp.text()
  let tweetData: any = {}
  try { tweetData = text ? JSON.parse(text) : {} } catch {}

  if (!tweetResp.ok || tweetData.errors) {
    const msg = tweetData.errors?.[0]?.message || tweetData.detail || `Twitter post failed: ${tweetResp.status}`
    throw new Error(msg)
  }

  console.log('[publishTwitter] Tweet posted successfully. Tweet ID:', tweetData.data?.id)
}

async function publishThreads(post: any, connection: any) {
  const accessToken = await getValidThreadsToken(connection)
  const userId = connection.account_id
  if (!userId || !accessToken) throw new Error('Threads user ID or access token missing.')

  if (post.media_type === 'image' || post.media_type === 'video') {
    if (!post.media_url) throw new Error('Threads publishing requires a media URL.')
    if (isDataUrl(post.media_url)) {
      throw new Error('Threads publishing requires a publicly accessible media URL.')
    }

    const containerUrl = `https://graph.threads.net/v1.0/${userId}/threads`
    const containerParams = new URLSearchParams({
      access_token: accessToken,
      media_type: post.media_type === 'video' ? 'VIDEO' : 'IMAGE',
      media_url: post.media_url,
      text: post.caption || '',
    })

    if (await testGuard('threads', containerUrl, 'POST', containerParams, connection, post)) return

    const containerResp = await fetch(containerUrl, { method: 'POST', body: containerParams })
    const containerData = await containerResp.json()
    if (!containerResp.ok || containerData.error) {
      throw new Error(containerData.error?.message || 'Failed to create Threads media container')
    }

    const creationId = containerData.id
    if (!creationId) throw new Error('Threads media container creation failed')

    const publishUrl = `https://graph.threads.net/v1.0/${userId}/threads_publish`
    const publishBody = new URLSearchParams({ access_token: accessToken, creation_id: creationId })
    if (await testGuard('threads', publishUrl, 'POST', publishBody, connection, post)) return
    const publishResp = await fetch(publishUrl, { method: 'POST', body: publishBody })
    const publishData = await publishResp.json()
    if (!publishResp.ok || publishData.error) {
      throw new Error(publishData.error?.message || 'Failed to publish Threads media')
    }
    return
  }

  const postUrl = `https://graph.threads.net/v1.0/${userId}/threads`
  const postBody = new URLSearchParams({
    access_token: accessToken,
    text: post.caption || '',
    media_type: 'TEXT',
  })
  if (await testGuard('threads', postUrl, 'POST', postBody, connection, post)) return
  const resp = await fetch(postUrl, { method: 'POST', body: postBody })
  const data = await resp.json()
  if (!resp.ok || data.error) {
    throw new Error(data.error?.message || 'Failed to publish Threads text post')
  }

  const publishUrl2 = `https://graph.threads.net/v1.0/${userId}/threads_publish`
  const publishBody2 = new URLSearchParams({ access_token: accessToken, creation_id: data.id })
  if (await testGuard('threads', publishUrl2, 'POST', publishBody2, connection, post)) return
  const publishResp2 = await fetch(publishUrl2, { method: 'POST', body: publishBody2 })
  const publishData2 = await publishResp2.json()
  if (!publishResp2.ok || publishData2.error) {
    throw new Error(publishData2.error?.message || 'Failed to publish Threads text post')
  }
}

async function publishPlatform(post: any, connection: any) {
  switch (connection.platform) {
    case 'facebook':
      return publishFacebook(post, connection)
    case 'instagram':
      return publishInstagram(post, connection)
    case 'whatsapp':
      return publishWhatsApp(post, connection)
    case 'youtube':
      return publishYouTube(post, connection)
    case 'tiktok':
      return publishTikTok(post, connection)
    case 'twitter':
    case 'x':
      return publishTwitter(post, connection)
    case 'threads':
      return publishThreads(post, connection)
    default:
      throw new Error(`Publishing for ${connection.platform} is not supported yet.`)
  }
}

export async function publishDueScheduledPosts(userId?: string, limit = 20) {
  const supabase = await getSupabaseAdmin()
  const now = new Date()

  let query = supabase.from('scheduled_posts').select('*').in('status', ['scheduled', 'failed']).limit(limit * 5)
  if (userId) query = query.eq('user_id', userId)

  const { data: allScheduled, error: dueError } = await query
  if (dueError) throw dueError

  const duePosts = (allScheduled || []).filter((post: any) => {
    if (!post.scheduled_date || !post.scheduled_time) return false
    const postTime = new Date(`${post.scheduled_date}T${post.scheduled_time}`)
    return isNaN(postTime.getTime()) ? false : postTime <= now
  }).slice(0, limit)

  if (duePosts.length === 0) {
    return { posted: 0, failed: 0, partial: 0, errors: [] }
  }

  const { data: connections, error: connError } = await supabase
    .from('social_connects')
    .select('*')
    .eq('status', 'active')
    .in('platform', ['facebook', 'instagram', 'whatsapp', 'youtube', 'tiktok', 'twitter', 'threads'])

  if (connError) throw connError

  const errors: string[] = []
  let posted = 0
  let failed = 0
  let partial = 0

  for (const post of duePosts) {
    try {
      const platforms = Array.isArray(post.platforms) ? post.platforms : []
      if (platforms.length === 0) throw new Error('No platforms selected for scheduled post.')

      const results: { platform: string; success: boolean; error?: string }[] = []

      for (const platform of platforms) {
        const connection = connections.find(
          (conn: any) => conn.platform === platform && conn.user_id === post.user_id,
        )
        if (!connection) {
          results.push({ platform, success: false, error: `Platform ${platform} is not connected.` })
          continue
        }
        try {
          await publishPlatform(post, connection)
          results.push({ platform, success: true })
        } catch (err: any) {
          results.push({ platform, success: false, error: err?.message || String(err) })
        }
      }

      const successCount = results.filter((r) => r.success).length
      if (successCount === platforms.length) {
        await updateOne('scheduled_posts', { id: post.id }, { status: 'posted', updated_at: new Date().toISOString() })
        posted += 1
      } else if (successCount === 0) {
        failed += 1
        errors.push(`Post ${post.id}: All platforms failed. ${results.map((r) => `${r.platform}: ${r.error || 'unknown'}`).join('; ')}`)
        await updateOne('scheduled_posts', { id: post.id }, { status: 'failed', updated_at: new Date().toISOString() })
      } else {
        partial += 1
        errors.push(`Post ${post.id}: Partial success. ${results.map((r) => `${r.platform}: ${r.success ? 'OK' : r.error}`).join('; ')}`)
        await updateOne('scheduled_posts', { id: post.id }, { status: 'partial', updated_at: new Date().toISOString() })
      }
    } catch (error: any) {
      failed += 1
      errors.push(`Post ${post.id}: ${error?.message || String(error)}`)
      try {
        await updateOne('scheduled_posts', { id: post.id }, { status: 'failed', updated_at: new Date().toISOString() })
      } catch (updateError) {
        errors.push(`Unable to update failed status for ${post.id}: ${updateError}`)
      }
    }
  }

  return { posted, failed, partial, errors }
}
