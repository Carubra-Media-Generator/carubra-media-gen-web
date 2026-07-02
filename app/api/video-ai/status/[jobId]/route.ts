import { NextRequest, NextResponse } from 'next/server'
import { findOne, updateOne } from '@/lib/supabase'
import { creditUserCoins } from '@/lib/coins'
import { getUserFromRequest } from '@/middleware/auth'
import { getOperationEndpoint, getConfig, getSignedUrl } from '@/lib/vertex'

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

    const pollUrl = getOperationEndpoint(decodedJobId)
    console.log(`[video-ai] Polling URL: ${pollUrl}`)
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

    // For Veo, we need to POST the operation name to fetchPredictOperation
    console.log(`[video-ai] Fetching operation status via fetchPredictOperation...`)
    const pollRes = await fetch(pollUrl, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName: decodedJobId
      }),
    })
    console.log(`[video-ai] Operation status response: ${pollRes.status}`)

    if (!pollRes.ok) {
      const errorText = await pollRes.text()
      console.error(`[video-ai] Operation status error: ${errorText}`)
      throw new Error(`Vertex AI operation status error (${pollRes.status}): ${errorText}`)
    }

    const pollData = await pollRes.json()
    console.log('[video-ai] Vertex AI operation status:', JSON.stringify(pollData, null, 2))

    // Vertex AI long-running operation status
    const operationStatus = pollData.done ? 'completed' : (pollData.error ? 'failed' : 'processing')

    if (operationStatus === 'completed') {
      // Extract video URL from Vertex AI response
      // Veo response structure: response.videos[0].gcsUri
      const gcsUri = 
        pollData?.response?.videos?.[0]?.gcsUri ||
        pollData?.response?.generatedVideos?.[0]?.video?.uri ||
        pollData?.response?.generatedVideos?.[0]?.video?.url ||
        pollData?.response?.generatedVideos?.[0]?.uri ||
        pollData?.response?.generatedVideos?.[0]?.url ||
        null

      console.log(`[video-ai] Extracted GCS URI: ${gcsUri}`)

      // Generate signed URL if we have a GCS URI
      let videoUrl = gcsUri
      if (gcsUri && gcsUri.startsWith('gs://')) {
        try {
          videoUrl = await getSignedUrl(gcsUri)
          console.log(`[video-ai] Generated signed URL: ${videoUrl}`)
        } catch (signedUrlError: any) {
          console.error('[video-ai] Failed to generate signed URL:', signedUrlError)
          // Fall back to the GCS URI if signed URL generation fails
          videoUrl = gcsUri
        }
      }

      try {
        await updateOne(
          'videos',
          { job_id: decodedJobId },
          { status: 'completed', video_url: videoUrl }
        )
      } catch (dbErr) {
        console.error('[video-ai] Failed to update completed status in DB:', dbErr)
      }

      return NextResponse.json({ status: 'completed', videoUrl })
    }

    if (operationStatus === 'failed') {
      try {
        const existingVideo = await findOne('videos', { job_id: decodedJobId })
        await updateOne(
          'videos',
          { job_id: decodedJobId },
          { status: 'failed' }
        )
        if (existingVideo?.user_id === user.id && existingVideo.status !== 'failed' && Number(existingVideo.coins_used ?? 0) > 0) {
          await creditUserCoins(user.id, Number(existingVideo.coins_used))
        }
      } catch (dbErr) {
        console.error('[video-ai] Failed to update failed status in DB:', dbErr)
      }
      return NextResponse.json({ status: 'failed' })
    }

    return NextResponse.json({ status: 'processing' })

  } catch (error: any) {
    console.error('[video-ai] Status check error:', error)
    return NextResponse.json({ error: 'Failed to check video status', detail: String(error) }, { status: 502 })
  }
}
