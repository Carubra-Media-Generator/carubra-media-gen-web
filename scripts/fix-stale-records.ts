import { find, updateOne } from '../lib/supabase'

async function fixStaleRecords() {
  try {
    console.log('Fixing stale records...')

    // Fix video record with prompt "funny fish with big eyes"
    const videos = await find('videos', {}, { orderBy: 'created_at', ascending: false, limit: 500 })
    const staleVideo = videos.find((v: any) => v.prompt?.toLowerCase().includes('funny fish') && v.status === 'processing')
    
    if (staleVideo) {
      console.log('Found stale video:', staleVideo.id, staleVideo.prompt)
      await updateOne('videos', { id: staleVideo.id }, { status: 'completed' })
      console.log('Updated video status to completed')
    } else {
      console.log('No stale video found with prompt "funny fish with big eyes"')
    }

    // Fix strategy record with prompt "cara buat bakso"
    const strategies = await find('content_analysis', {}, { orderBy: 'created_at', ascending: false, limit: 500 })
    const staleStrategy = strategies.find((s: any) => s.prompt?.toLowerCase().includes('cara buat bakso') && s.status === 'processing')
    
    if (staleStrategy) {
      console.log('Found stale strategy:', staleStrategy.id, staleStrategy.prompt)
      await updateOne('content_analysis', { id: staleStrategy.id }, { status: 'completed' })
      console.log('Updated strategy status to completed')
    } else {
      console.log('No stale strategy found with prompt "cara buat bakso"')
    }

    console.log('Done fixing stale records')
  } catch (error) {
    console.error('Error fixing stale records:', error)
  }
}

fixStaleRecords()
