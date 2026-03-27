import { NextResponse } from "next/server";
import { listAssistantSessionMessages } from "../../../../../../lib/assistant-sessions";
import { getAuthedSupabase } from "../../../../../../lib/supabase/route-auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  try {
    const { sessionId } = await context.params;
    const data = await listAssistantSessionMessages(auth.supabase, auth.userId, sessionId);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load session messages.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
