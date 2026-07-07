import { NextRequest, NextResponse } from 'next/server'
import { findOne, updateOne, uploadToStorage } from '@/lib/supabase'
import { creditUserCoins } from '@/lib/coins'
import { getUserFromRequest } from '@/middleware/auth'
import { getOperationEndpoint, getConfig, getSignedUrl } from '@/lib/vertex'
import { v4 as uuidv4 } from 'uuid'

/**
 * Detect the MIME type from a file buffer's magic bytes.
 * Only checks for video formats relevant to Vertex AI Veo output.
 */
function detectMimeFromBuffer(buffer: Buffer): string {
  const len = buffer.length
  if (len < 12) return 'video/mp4' // fallback
  const header = buffer.subarray(0, 12).toString('hex').toLowerCase()
  // WebM / Matroska: 1a45dfa3
  if (header.startsWith('1a45dfa3')) return 'video/webm'
  // MP4: ftype box at offset 4 (bytes 4-7)
  if (header.substring(8, 16) === '66747970') return 'video/mp4'
  // QuickTime: 'ftyp' or 'moov' start
  if (header.includes('6d6f6f76')) return 'video/quicktime'
  return 'video/mp4' // fallback
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params

  console.log(`[video-ai] Status check for jobId: ${jobId}`)

  try {
    const decodedJobId = decodeURIComponent(jobId)
    console.log(`[video-ai] Decoded jobId: ${decodedJobId}`)

    const config = getConfig()

    console.log(`[video-ai] Getting access token for status check...`)
    const { GoogleAuth } = require('google-auth-library')
    const auth = new GoogleAuth({
      keyFilename: config.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    })
    const client = await auth.getClient()
    const accessToken = (await client.getAccessToken()).token
    console.log(`[video-ai] Access token obtained for status check`)

    let pollData: any = null
    let pollingStrategy = 'none'

    // Strategy 1: Use fetchPredictOperation (Veo-specific endpoint)
    try {
      const fetchPredictUrl = getOperationEndpoint(decodedJobId)
      console.log(`[video-ai] Strategy 1 - fetchPredictOperation: ${fetchPredictUrl}`)

      const pollRes = await fetch(fetchPredictUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationName: decodedJobId
        }),
      })
      console.log(`[video-ai] fetchPredictOperation status: ${pollRes.status}`)

      if (pollRes.ok) {
        pollData = await pollRes.json()
        pollingStrategy = 'fetchPredictOperation'
        console.log('[video-ai] fetchPredictOperation full response:', JSON.stringify(pollData, null, 2))
        // Log top-level field names to help debug response structure
        if (pollData && typeof pollData === 'object') {
          console.log('[video-ai] response top-level keys:', Object.keys(pollData))
          const inner = pollData.operation || pollData // some endpoints wrap
          if (inner !== pollData) {
            console.log('[video-ai] unwrapped operation keys:', Object.keys(inner))
          }
          const resp = inner.response || inner
          if (resp && typeof resp === 'object' && resp !== inner) {
            console.log('[video-ai] response field keys:', Object.keys(resp))
          }
        }
      } else {
        const errText = await pollRes.text()
        console.warn(`[video-ai] fetchPredictOperation failed (${pollRes.status}): ${errText}`)
      }
    } catch (fetchPredictErr: any) {
      console.warn(`[video-ai] fetchPredictOperation threw: ${fetchPredictErr.message}`)
    }

    // Strategy 2: Standard LRO GET endpoint as fallback
    if (!pollData) {
      try {
        const lroUrl = `https://${config.location}-aiplatform.googleapis.com/v1/${decodedJobId}`
        console.log(`[video-ai] Strategy 2 - Standard LRO GET: ${lroUrl}`)

        const lroRes = await fetch(lroUrl, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        console.log(`[video-ai] LRO GET status: ${lroRes.status}`)

        if (lroRes.ok) {
          pollData = await lroRes.json()
          pollingStrategy = 'lroGet'
          console.log('[video-ai] LRO GET full response:', JSON.stringify(pollData, null, 2))
          if (pollData && typeof pollData === 'object') {
            console.log('[video-ai] LRO GET top-level keys:', Object.keys(pollData))
            const resp = pollData.response || pollData
            if (resp && typeof resp === 'object' && resp !== pollData) {
              console.log('[video-ai] LRO response field keys:', Object.keys(resp))
            }
          }
        } else {
          const errText = await lroRes.text()
          console.error(`[video-ai] LRO GET also failed (${lroRes.status}): ${errText}`)
          throw new Error(`Both polling strategies failed. LRO GET error (${lroRes.status}): ${errText}`)
        }
      } catch (lroErr: any) {
        throw new Error(`All polling strategies exhausted: ${lroErr.message}`)
      }
    }

    // Interpret Vertex AI long-running operation status
    const operationStatus = pollData.done
      ? (pollData.error ? 'failed' : 'completed')
      : 'processing'

    console.log(`[video-ai] Resolved operation status: ${operationStatus} (polling strategy: ${pollingStrategy})`)

    if (operationStatus === 'completed') {
      // DIAGNOSTIC: step-by-step inspection of the response structure
      console.log('[video-ai] DIAG: pollData type:', typeof pollData)
      console.log('[video-ai] DIAG: pollData keys:', pollData ? Object.keys(pollData) : 'N/A')
      const resp = pollData?.response
      console.log('[video-ai] DIAG: response type:', typeof resp)
      if (resp) {
        console.log('[video-ai] DIAG: response keys:', Object.keys(resp))
        console.log('[video-ai] DIAG: response @type:', resp['@type'])
        console.log('[video-ai] DIAG: videos type:', typeof resp.videos)
        console.log('[video-ai] DIAG: videos isArray:', Array.isArray(resp.videos))
        console.log('[video-ai] DIAG: videos length:', resp.videos?.length)
        const video0 = resp.videos?.[0]
        if (video0) {
          console.log('[video-ai] DIAG: video0 keys:', Object.keys(video0))
          console.log('[video-ai] DIAG: video0.bytesBase64Encoded type:', typeof video0.bytesBase64Encoded)
          console.log('[video-ai] DIAG: video0.bytesBase64Encoded length:', typeof video0.bytesBase64Encoded === 'string' ? video0.bytesBase64Encoded.length : 'N/A')
          console.log('[video-ai] DIAG: video0.bytesBase64Encoded first 30:', typeof video0.bytesBase64Encoded === 'string' ? video0.bytesBase64Encoded.substring(0, 30) : 'N/A')
          console.log('[video-ai] DIAG: video0.mimeType:', video0.mimeType)
          console.log('[video-ai] DIAG: video0.gcsUri:', video0.gcsUri)
        }
      }
      // Also check if data is at operation.response instead of response
      const wrappedResp = pollData?.operation?.response
      if (wrappedResp) {
        console.log('[video-ai] DIAG: operation.response exists with keys:', Object.keys(wrappedResp))
        console.log('[video-ai] DIAG: operation.response videos:', wrappedResp.videos ? 'EXISTS' : 'NULL')
      }

      let videoUrl: string | null = null
      let fileBuffer: Buffer | null = null
      let detectedMime = 'video/mp4'

      // Strategy A: extract base64 video from videos[0] (Veo 2.0 GenerateVideoResponse)
      // Response structure: { videos: [{ bytesBase64Encoded: string, mimeType: string }] }
      const firstVideo = pollData?.response?.videos?.[0]
      const encodedVideo: string | null = firstVideo?.bytesBase64Encoded || null
      const inlineMimeType: string | null = firstVideo?.mimeType || null

      console.log(`[video-ai] Inline encodedVideo present: ${!!encodedVideo}`)
      console.log(`[video-ai] Inline mimeType: ${inlineMimeType}`)
      if (encodedVideo) {
        console.log(`[video-ai] encodedVideo length (chars): ${encodedVideo.length}`)
      }

      // Strategy B: extract GCS URI from Vertex AI response (legacy paths)
      const gcsUri: string | null =
        pollData?.response?.videos?.[0]?.gcsUri ||
        pollData?.response?.videos?.[0]?.uri ||
        pollData?.response?.videos?.[0]?.bytesBase64Encoded || // already handled above, keep for consistency
        pollData?.response?.predictions?.[0]?.gcsUri ||
        pollData?.response?.predictions?.[0]?.uri ||
        pollData?.response?.predictions?.[0]?.video?.uri ||
        pollData?.response?.predictions?.[0]?.payload?.gcsUri ||
        pollData?.response?.predictions?.[0]?.payload?.videoUri ||
        pollData?.response?.generated_videos?.[0]?.video?.uri ||
        pollData?.response?.generated_videos?.[0]?.video?.url ||
        pollData?.response?.generated_videos?.[0]?.gcsUri ||
        pollData?.response?.generated_videos?.[0]?.uri ||
        pollData?.response?.generatedVideos?.[0]?.video?.uri ||
        pollData?.response?.generatedVideos?.[0]?.video?.url ||
        pollData?.response?.generatedVideos?.[0]?.gcsUri ||
        pollData?.response?.generatedVideos?.[0]?.uri ||
        pollData?.response?.outputUri ||
        pollData?.metadata?.videos?.[0]?.gcsUri ||
        pollData?.metadata?.generated_videos?.[0]?.video?.uri ||
        pollData?.metadata?.outputUri ||
        pollData?.metadata?.artifactUri ||
        null

      console.log(`[video-ai] Extracted GCS URI: "${gcsUri}"`)

      // Priority 1: inline base64-encoded video (Veo 2.0 direct response)
      if (encodedVideo) {
        try {
          detectedMime = inlineMimeType || 'video/mp4'
          console.log(`[video-ai] Decoding inline base64 video (mime: ${detectedMime})...`)
          fileBuffer = Buffer.from(encodedVideo, 'base64')
          console.log(`[video-ai] Decoded buffer size: ${fileBuffer.length} bytes`)
          if (fileBuffer.length === 0) {
            throw new Error('Decoded base64 video is 0 bytes')
          }
          const magicMime = detectMimeFromBuffer(fileBuffer)
          console.log(`[video-ai] Magic-byte MIME: ${magicMime} (declared: ${detectedMime})`)
        } catch (decodeErr: any) {
          console.error(`[video-ai] Failed to decode inline video:`, decodeErr.message)
          fileBuffer = null
        }
      }

      // Priority 2: download from GCS (only if no inline payload)
      if (!fileBuffer && gcsUri && typeof gcsUri === 'string' && gcsUri.startsWith('gs://')) {
        try {
          const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/)
          if (match) {
            const gcsBucketName = match[1]
            const gcsFileName = match[2]

            const { Storage } = require('@google-cloud/storage')
            const gcsStorage = new Storage({
              keyFilename: config.credentialsPath,
            })

            console.log(`[video-ai] Downloading video from GCS bucket=${gcsBucketName} file=${gcsFileName}`)

            try {
              const [metadata] = await gcsStorage.bucket(gcsBucketName).file(gcsFileName).getMetadata()
              console.log(`[video-ai] GCS file metadata:`, JSON.stringify({
                size: metadata.size,
                contentType: metadata.contentType,
                contentEncoding: metadata.contentEncoding,
                md5Hash: metadata.md5Hash,
                updated: metadata.updated,
              }, null, 2))
            } catch (metaErr: any) {
              console.warn(`[video-ai] Could not get GCS file metadata:`, metaErr.message)
            }

            const [downloadedBuffer] = await gcsStorage.bucket(gcsBucketName).file(gcsFileName).download()
            fileBuffer = downloadedBuffer
            detectedMime = detectMimeFromBuffer(fileBuffer)
            console.log(`[video-ai] Downloaded buffer size: ${fileBuffer.length} bytes`)
            console.log(`[video-ai] Buffer first 16 bytes (hex): ${fileBuffer.subarray(0, 16).toString('hex')}`)
            console.log(`[video-ai] Detected MIME type from magic bytes: ${detectedMime}`)

            if (fileBuffer.length === 0) {
              throw new Error('Downloaded file is 0 bytes — video file is empty')
            }
          } else {
            console.error(`[video-ai] Failed to parse gs:// URI: ${gcsUri}`)
          }
        } catch (storageError: any) {
          console.error('[video-ai] Failed Supabase storage transfer process:', storageError)
          try {
            videoUrl = await getSignedUrl(gcsUri)
            console.log(`[video-ai] Fallback GCS signed URL generated: ${videoUrl}`)
          } catch (signedUrlError: any) {
            console.error('[video-ai] GCS fallback signed URL also failed:', signedUrlError.message)
            videoUrl = gcsUri
          }
        }
      } else if (!fileBuffer && gcsUri && typeof gcsUri === 'string' && gcsUri.startsWith('http')) {
        console.log(`[video-ai] Veo returned HTTPS URL directly (no gs://): ${gcsUri}`)
        videoUrl = gcsUri
      } else if (!fileBuffer && !gcsUri) {
        console.warn('[video-ai] No video data found in completed response')
      }

      // Upload buffer to Supabase Storage (shared by both strategies)
      if (fileBuffer && !videoUrl) {
        try {
          const existingVideo = await findOne('videos', { job_id: decodedJobId })
          const videoId = existingVideo ? existingVideo.id : uuidv4()
          const supabasePath = `videos/${videoId}.mp4`
          const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || 'whatsapp'

          console.log(`[video-ai] Uploading to Supabase Storage: bucket=${supabaseBucket}, path=${supabasePath}, contentType=${detectedMime}`)
          const publicUrl = await uploadToStorage(supabaseBucket, supabasePath, fileBuffer, {
            contentType: detectedMime,
            cacheControl: 'public, max-age=31536000',
          })
          console.log(`[video-ai] Supabase upload successful, public URL: ${publicUrl}`)

          try {
            const verifyRes = await fetch(publicUrl, { method: 'HEAD' })
            console.log(`[video-ai] Verify upload HEAD status: ${verifyRes.status}`)
            console.log(`[video-ai] Verify upload content-type: ${verifyRes.headers.get('content-type')}`)
            console.log(`[video-ai] Verify upload content-length: ${verifyRes.headers.get('content-length')}`)
          } catch (verifyErr: any) {
            console.warn(`[video-ai] Upload verification HEAD failed:`, verifyErr.message)
          }

          videoUrl = publicUrl

          // Cleanup GCS file if we downloaded from GCS
          if (gcsUri && typeof gcsUri === 'string' && gcsUri.startsWith('gs://')) {
            try {
              const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/)
              if (match) {
                const { Storage } = require('@google-cloud/storage')
                const gcsStorage = new Storage({ keyFilename: config.credentialsPath })
                console.log(`[video-ai] Deleting temporary GCS file: ${gcsUri}`)
                await gcsStorage.bucket(match[1]).file(match[2]).delete()
                console.log(`[video-ai] Deleted temporary GCS file successfully`)
              }
            } catch (deleteError: any) {
              console.warn(`[video-ai] Failed to delete temporary GCS file:`, deleteError.message)
            }
          }
        } catch (uploadError: any) {
          console.error('[video-ai] Supabase upload failed:', uploadError)
          // Fallback: try signed URL if this was a GCS URI
          if (gcsUri && typeof gcsUri === 'string' && gcsUri.startsWith('gs://')) {
            try {
              videoUrl = await getSignedUrl(gcsUri)
              console.log(`[video-ai] Fallback GCS signed URL generated: ${videoUrl}`)
            } catch (signedUrlError: any) {
              console.error('[video-ai] GCS fallback signed URL also failed:', signedUrlError.message)
              videoUrl = gcsUri
            }
          }
        }
      }

      try {
        await updateOne(
          'videos',
          { job_id: decodedJobId },
          { status: 'completed', video_url: videoUrl ?? null }
        )
        console.log(`[video-ai] DB updated: status=completed, video_url=${videoUrl ?? '(null)'}`)
      } catch (dbErr) {
        console.error('[video-ai] Failed to update completed status in DB:', dbErr)
      }

      const responsePayload = { status: 'completed', videoUrl: videoUrl ?? null }
      console.log(`[video-ai] Returning to frontend:`, JSON.stringify(responsePayload))
      return NextResponse.json(responsePayload)
    }

    if (operationStatus === 'failed') {
      const errorDetail = pollData.error
        ? `${pollData.error.message || ''} (code: ${pollData.error.code || 'unknown'})`
        : 'Unknown error'
      console.error(`[video-ai] Operation failed: ${errorDetail}`)

      try {
        const existingVideo = await findOne('videos', { job_id: decodedJobId })
        await updateOne('videos', { job_id: decodedJobId }, { status: 'failed' })
        if (
          existingVideo?.user_id === user.id &&
          existingVideo.status !== 'failed' &&
          Number(existingVideo.coins_used ?? 0) > 0
        ) {
          await creditUserCoins(user.id, Number(existingVideo.coins_used))
          console.log(`[video-ai] Refunded ${existingVideo.coins_used} coins to user ${user.id}`)
        }
      } catch (dbErr) {
        console.error('[video-ai] Failed to update failed status in DB:', dbErr)
      }
      return NextResponse.json({ status: 'failed', detail: errorDetail })
    }

    return NextResponse.json({ status: 'processing' })

  } catch (error: any) {
    console.error('[video-ai] Status check error:', error)
    return NextResponse.json({ error: 'Failed to check video status', detail: String(error) }, { status: 502 })
  }
}
