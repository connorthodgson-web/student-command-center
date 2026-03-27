import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../lib/supabase/route-auth";
import { listUserConversations } from "../../../../lib/messaging-service";

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  try {
    const conversations = await listUserConversations(auth.userId);
    return NextResponse.json({ data: conversations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load conversations.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
