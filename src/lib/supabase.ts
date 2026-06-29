// Browser Supabase client (anon key). Reads happen under RLS; once a player
// signs in with Google the session JWT carries their email, which RLS maps to
// their player row (see current_player_id()).
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // Persist the Google session across reloads and refresh it automatically;
    // parse the OAuth fragment Supabase appends on the redirect back from Google.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
