import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const TEST_EMAIL = "test@student.dev";
const TEST_PASSWORD = "test1234";

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Test mode is unavailable right now. The server is missing the Supabase service role key.",
      },
      { status: 503 }
    );
  }

  const supabaseAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });

  if (error && !isExistingUserError(error.message)) {
    return NextResponse.json(
      {
        error:
          "Test mode is unavailable right now. The shared test account could not be prepared.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

function isExistingUserError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been registered") ||
    normalized.includes("already registered") ||
    normalized.includes("user already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("duplicate")
  );
}
