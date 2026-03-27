import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../../lib/supabase/route-auth";
import { listConversationMessages } from "../../../../../../lib/messaging-service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { conversationId } = await context.params;

  try {
    const messages = await listConversationMessages(conversationId, auth.userId);
    return NextResponse.json({ data: messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load messages.";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
