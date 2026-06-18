// ============================================================
// src/utils/db.ts
// Supabase client for twobrains-lakehouse.
// INDEPENDENT from asset-governance and Catastro.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.SUPABASE_ANON_KEY
           ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[twobrains-lakehouse] Missing env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project credentials.'
    );
  }

  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/** Whether the database integration is active. */
export const DB_ENABLED = process.env.USE_DB === 'true';

/** Convenience: run a raw SQL query (service role only). */
export async function sql<T = Record<string, unknown>>(
  query: string,
  params?: unknown[]
): Promise<T[]> {
  const db = getDb();
  const { data, error } = await db.rpc('exec_sql', { query, params: params ?? [] });
  if (error) throw new Error(`[twobrains-lakehouse] SQL error: ${error.message}`);
  return (data ?? []) as T[];
}
