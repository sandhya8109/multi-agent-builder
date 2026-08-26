import { createBrowserClient } from '@supabase/ssr';
import { hasSupabaseConfig } from '@/lib/env';

export function createClient() {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase is not configured. Use demo mode or add env vars.');
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
