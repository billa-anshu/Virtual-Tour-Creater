import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fogqiruqayzamorywwkl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvZ3FpcnVxYXl6YW1vcnl3d2tsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5NjAxODAsImV4cCI6MjA2NjUzNjE4MH0.fa0st9V3allcHbD-Nklnh9ajYLRXgwSXWMnxBhp81hA'; // from Supabase project settings

export const supabase = createClient(supabaseUrl, supabaseAnonKey);