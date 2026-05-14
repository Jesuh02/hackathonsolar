import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client using the service-role key.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (server-side only — never NEXT_PUBLIC_*).
 * Returns null if the env vars are missing so callers can fall back gracefully.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
