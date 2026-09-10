// Server-only Supabase client, using the service role key instead of the
// anon key. This bypasses Row Level Security entirely, so it must NEVER be
// imported from a "use client" file or anything else that ends up in the
// browser bundle — only from files under app/api/**/route.ts (Next.js
// Route Handlers, which always run server-side).
//
// Why this exists: the Clover connection (merchant id + access token) is
// sensitive and has no anon RLS policies at all — the dashboard's usual
// anon-key client can't read or write it, on purpose. Only these
// server-side routes, using this admin client, can.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin: SupabaseClient | null =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    : null;

export const isSupabaseAdminConfigured = Boolean(supabaseAdmin);
