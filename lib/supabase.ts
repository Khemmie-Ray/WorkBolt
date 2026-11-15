import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; 

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const NOT_CONFIGURED =
  "Workbolt isn't connected to its database. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

export function db(): SupabaseClient {
  if (!supabase) throw new Error(NOT_CONFIGURED);
  return supabase;
}
