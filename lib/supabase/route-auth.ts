import { NextResponse } from "next/server";
import { createClient } from "./server";

export async function getAuthedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    return {
      response: NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { supabase, userId: user.id };
}

export async function getOptionalAuthedSupabase() {
  const supabase = await createClient();
  if (!supabase) {
    return { supabase: null, userId: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    userId: user?.id ?? null,
  };
}
