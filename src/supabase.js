import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wefcbqfxzvvgremxhubi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZmNicWZ4enZ2Z3JlbXhodWJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTI1NjUsImV4cCI6MjA4ODkyODU2NX0.vXTs_vh0dMvEt83FR589vKY9JfcMBFVgN82QblQH6OU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
