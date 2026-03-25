import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./env";

// Browser-side Supabase client — safe to use in Client Components.
// Returns null when Supabase env vars are not configured.
export function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;
  return createBrowserClient(config.url, config.anonKey);
}
