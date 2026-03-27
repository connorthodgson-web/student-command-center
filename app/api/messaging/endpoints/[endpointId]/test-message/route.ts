import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../../lib/supabase/route-auth";
import { sendTestMessageToEndpoint } from "../../../../../../lib/messaging-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ endpointId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { endpointId } = await context.params;

  try {
    const message = await sendTestMessageToEndpoint(auth.userId, endpointId);
    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send test message.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
