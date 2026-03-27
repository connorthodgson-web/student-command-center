import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../../../lib/supabase/route-auth";
import { confirmEndpointVerification } from "../../../../../../../lib/messaging-service";

type ConfirmVerificationRequest = {
  code?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ endpointId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { endpointId } = await context.params;
  const body = (await request.json()) as ConfirmVerificationRequest;

  if (!body.code?.trim()) {
    return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
  }

  try {
    const endpoint = await confirmEndpointVerification(auth.userId, endpointId, body.code.trim());
    return NextResponse.json({ data: endpoint }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm verification.";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
