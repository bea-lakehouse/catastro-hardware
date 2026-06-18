/**
 * lib/db/client.ts
 *
 * Supabase client singleton.
 * Server-side only — never import from Client Components.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY so the services can bypass
 * Row Level Security for read queries.  When RLS is enabled
 * in Sprint 3 you can switch to the anon key + user JWT.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let _client: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
  }

  _client = createClient<Database>(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}

/**
 * Whether the Supabase integration is enabled.
 * Checked once at module load — change USE_SUPABASE in .env.local to switch.
 */
export const DB_ENABLED = process.env.USE_SUPABASE === 'true';
