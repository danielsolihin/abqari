import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Hanya cipta satu instans (singleton) untuk digunakan oleh semua fail
export const supabase = createClient(supabaseUrl, supabaseAnonKey);