import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load .env.local file
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addCoins() {
  try {
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'user7@gmail.com')
      .single()

    if (findError || !user) {
      console.error('User not found:', findError)
      process.exit(1)
    }

    const currentCoins = user.coins || 0
    const newCoins = currentCoins + 20

    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        coins: newCoins,
        updated_at: new Date().toISOString()
      })
      .eq('email', 'user7@gmail.com')

    if (updateError) {
      console.error('Error updating coins:', updateError)
      process.exit(1)
    }

    console.log(`Successfully added 20 coins to user7@gmail.com`)
    console.log(`Previous balance: ${currentCoins}`)
    console.log(`New balance: ${newCoins}`)
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

addCoins()
