import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wefcbqfxzvvgremxhubi.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!supabaseAnonKey) throw new Error('VITE_SUPABASE_ANON_KEY env var missing')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
