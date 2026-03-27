import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../../../lib/supabase/route-auth";
import { startEndpointVerification } from "../../../../../../../lib/messaging-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ endpointId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { endpointId } = await context.params;

  try {
    const result = await startEndpointVerification(auth.userId, endpointId);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start verification.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
