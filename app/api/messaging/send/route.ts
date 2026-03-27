import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../lib/supabase/route-auth";
import { sendOutboundConversationMessage } from "../../../../lib/messaging-service";
import { createAdminClient } from "../../../../lib/supabase/admin";

type SendOutboundMessageRequest = {
  conversationId?: string;
  content?: string;
  providerKey?: string;
  assistantAddress?: string;
};

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as SendOutboundMessageRequest;
  if (!body.conversationId || !body.content?.trim()) {
    return NextResponse.json(
      { error: "conversationId and content are required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Supabase admin access is not configured." },
      { status: 503 },
    );
  }

  const { data: conversation, error } = await admin
    .from("messaging_conversations")
    .select("id, user_id")
    .eq("id", body.conversationId)
    .maybeSingle();

  if (error || !conversation || conversation.user_id !== auth.userId) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  try {
    const message = await sendOutboundConversationMessage({
      conversationId: body.conversationId,
      content: body.content.trim(),
      providerKey: body.providerKey,
      assistantAddress: body.assistantAddress,
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : "Failed to send outbound message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
