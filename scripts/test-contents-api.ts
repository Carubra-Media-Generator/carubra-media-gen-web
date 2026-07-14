import { find } from '../lib/supabase'

async function testContentsAPI() {
  try {
    console.log('Testing Supabase connection and fetching contents...')
    const contents = await find('generated_contents', {}, { orderBy: 'created_at', ascending: false, limit: 200 })
    console.log('Contents found:', contents.length)
    if (contents.length > 0) {
      console.log('Sample content:', contents[0])
    } else {
      console.log('No contents found in database. The table might be empty.')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

testContentsAPI()
