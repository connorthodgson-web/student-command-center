// Returns validated Supabase config, or null if env vars are missing/placeholder.
// Used by middleware, client, and server to fail gracefully instead of hard-crashing.
export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey || url.startsWith("your-") || anonKey.startsWith("your-")) {
    return null;
  }

  try {
    new URL(url);
  } catch {
    return null;
  }

  return { url, anonKey };
}
