// Thin Supabase client wrapper.
//
// Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Both are
// meant to be public (the anon key is safe to ship to the browser — Row
// Level Security on the tables is what actually protects the data).
//
// If they aren't set yet, `supabase` is null and every call site in this
// app falls back to local mock data instead of crashing, so the site keeps
// working before Supabase is wired up.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);
