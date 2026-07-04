import { NextRequest, NextResponse } from 'next/server'
import { findOne, updateOne, uploadToStorage } from '@/lib/supabase'
import { creditUserCoins } from '@/lib/coins'
import { getUserFromRequest } from '@/middleware/auth'
import { getOperationEndpoint, getConfig, getSignedUrl } from '@/lib/vertex'
import { v4 as uuidv4 } from 'uuid'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await params

  // jobId is the Vertex AI operation name
  console.log(`[video-ai] Status check for jobId: ${jobId}`)

  try {
    // Decode URL-encoded operation name
    const decodedJobId = decodeURIComponent(jobId)
    console.log(`[video-ai] Decoded jobId: ${decodedJobId}`)

    const config = getConfig()

    // Get Google Cloud access token
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
        console.log('[video-ai] fetchPredictOperation response:', JSON.stringify(pollData, null, 2))
      } else {
        const errText = await pollRes.text()
        console.warn(`[video-ai] fetchPredictOperation failed (${pollRes.status}): ${errText}`)
        // Fall through to Strategy 2
      }
    } catch (fetchPredictErr: any) {
      console.warn(`[video-ai] fetchPredictOperation threw: ${fetchPredictErr.message}`)
      // Fall through to Strategy 2
    }

    // Strategy 2: Standard LRO GET endpoint as fallback
    if (!pollData) {
      // The operation name from Vertex looks like:
      // projects/{project}/locations/{location}/operations/{opId}
      // Standard LRO GET: GET https://{location}-aiplatform.googleapis.com/v1/{operationName}
      try {
        const lroUrl = `https://${config.location}-aiplatform.googleapis.com/v1/${decodedJobId}`
        console.log(`[video-ai] Strategy 2 - Standard LRO GET: ${lroUrl}`)

        const lroRes = await fetch(lroUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })
        console.log(`[video-ai] LRO GET status: ${lroRes.status}`)

        if (lroRes.ok) {
          pollData = await lroRes.json()
          console.log('[video-ai] LRO GET response:', JSON.stringify(pollData, null, 2))
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

    console.log(`[video-ai] Resolved operation status: ${operationStatus}`)

    if (operationStatus === 'completed') {
      // Extract GCS URI from Vertex AI / Veo response structure
      // Try multiple known response shapes
      const gcsUri: string | null =
        pollData?.response?.videos?.[0]?.gcsUri ||
        pollData?.response?.generated_videos?.[0]?.video?.uri ||
        pollData?.response?.generated_videos?.[0]?.video?.url ||
        pollData?.response?.generated_videos?.[0]?.gcsUri ||
        pollData?.response?.generated_videos?.[0]?.uri ||
        pollData?.response?.generatedVideos?.[0]?.video?.uri ||
        pollData?.response?.generatedVideos?.[0]?.video?.url ||
        pollData?.response?.generatedVideos?.[0]?.gcsUri ||
        pollData?.response?.generatedVideos?.[0]?.uri ||
        pollData?.metadata?.videos?.[0]?.gcsUri ||
        null

      console.log(`[video-ai] Extracted GCS URI: ${gcsUri}`)

      let videoUrl: string | null = null
      if (gcsUri && typeof gcsUri === 'string' && gcsUri.startsWith('gs://')) {
        try {
          const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/)
          if (match) {
            const gcsBucketName = match[1]
            const gcsFileName = match[2]
            
            // Initialize Storage client
            const { Storage } = require('@google-cloud/storage')
            const gcsStorage = new Storage({
              keyFilename: config.credentialsPath,
            })
            
            console.log(`[video-ai] Downloading video from GCS: ${gcsUri}`)
            const [fileBuffer] = await gcsStorage.bucket(gcsBucketName).file(gcsFileName).download()
            console.log(`[video-ai] Downloaded buffer of size: ${fileBuffer.length}`)
            
            const existingVideo = await findOne('videos', { job_id: decodedJobId })
            const videoId = existingVideo ? existingVideo.id : uuidv4()
            const supabasePath = `videos/${videoId}.mp4`
            const supabaseBucket = process.env.SUPABASE_STORAGE_BUCKET || 'whatsapp'
            
            console.log(`[video-ai] Uploading to Supabase Storage: bucket=${supabaseBucket}, path=${supabasePath}`)
            const publicUrl = await uploadToStorage(supabaseBucket, supabasePath, fileBuffer, {
              contentType: 'video/mp4',
              cacheControl: 'public, max-age=31536000',
            })
            console.log(`[video-ai] Supabase upload successful, public URL: ${publicUrl}`)
            videoUrl = publicUrl

            // Delete temporary file from GCS
            try {
              console.log(`[video-ai] Deleting temporary GCS file: ${gcsUri}`)
              await gcsStorage.bucket(gcsBucketName).file(gcsFileName).delete()
              console.log(`[video-ai] Deleted temporary GCS file successfully`)
            } catch (deleteError: any) {
              console.warn(`[video-ai] Failed to delete temporary GCS file:`, deleteError.message)
            }
          }
        } catch (storageError: any) {
          console.error('[video-ai] Failed Supabase storage transfer process:', storageError)
          // Fallback: Generate signed URL for GCS object so that the user gets the video at all
          try {
            videoUrl = await getSignedUrl(gcsUri)
            console.log(`[video-ai] Fallback GCS signed URL generated: ${videoUrl}`)
          } catch (signedUrlError: any) {
            console.error('[video-ai] GCS fallback signed URL also failed:', signedUrlError.message)
            videoUrl = gcsUri
          }
        }
      } else if (!gcsUri) {
        console.warn('[video-ai] No GCS URI found in completed response — video may not be accessible')
      }

      try {
        await updateOne(
          'videos',
          { job_id: decodedJobId },
          { status: 'completed', video_url: videoUrl ?? null }
        )
      } catch (dbErr) {
        console.error('[video-ai] Failed to update completed status in DB:', dbErr)
      }

      return NextResponse.json({ status: 'completed', videoUrl: videoUrl ?? null })
    }

    if (operationStatus === 'failed') {
      const errorDetail = pollData.error
        ? `${pollData.error.message || ''} (code: ${pollData.error.code || 'unknown'})`
        : 'Unknown error'
      console.error(`[video-ai] Operation failed: ${errorDetail}`)

      try {
        const existingVideo = await findOne('videos', { job_id: decodedJobId })
        await updateOne(
          'videos',
          { job_id: decodedJobId },
          { status: 'failed' }
        )
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

    // Still processing
    return NextResponse.json({ status: 'processing' })

  } catch (error: any) {
    console.error('[video-ai] Status check error:', error)
    return NextResponse.json({ error: 'Failed to check video status', detail: String(error) }, { status: 502 })
  }
}
