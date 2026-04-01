import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../lib/supabase/route-auth";
import {
  mapDbMessagingEndpoint,
  normalizeChannelAddress,
  type DbMessagingEndpointRow,
} from "../../../../../lib/messaging-data";
import { setPreferredEndpoint } from "../../../../../lib/messaging-service";

type UpdateEndpointRequest = {
  isPreferred?: boolean;
  isActive?: boolean;
  address?: string;
  label?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ endpointId: string }> },
) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { endpointId } = await context.params;
  const body = (await request.json()) as UpdateEndpointRequest;

  if (body.isPreferred) {
    try {
      const endpoint = await setPreferredEndpoint(auth.userId, endpointId);
      return NextResponse.json({ data: endpoint });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update endpoint.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  const updatePayload: Record<string, unknown> = {};
  let shouldResetVerification = false;

  if (typeof body.address === "string") {
    const normalizedAddress = normalizeChannelAddress("sms", body.address);
    const { data: existingDuplicate, error: duplicateLookupError } = await auth.supabase
      .from("messaging_endpoints")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("channel_type", "sms")
      .eq("address", normalizedAddress)
      .neq("id", endpointId)
      .maybeSingle();

    if (duplicateLookupError) {
      return NextResponse.json({ error: duplicateLookupError.message }, { status: 500 });
    }

    if (existingDuplicate) {
      return NextResponse.json(
        { error: "That phone number is already saved on this account." },
        { status: 400 },
      );
    }

    updatePayload.address = normalizedAddress;
    shouldResetVerification = true;
  }

  if (typeof body.label === "string") {
    const trimmedLabel = body.label.trim();
    updatePayload.label = trimmedLabel ? trimmedLabel : null;
  }

  if (typeof body.isActive === "boolean") {
    updatePayload.is_active = body.isActive;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: "No supported endpoint updates were provided." }, { status: 400 });
  }

  if (shouldResetVerification) {
    Object.assign(updatePayload, {
      is_active: false,
      is_preferred: false,
      verification_status: "not_started",
      verified_at: null,
      verification_code_hash: null,
      verification_expires_at: null,
      verification_attempt_count: 0,
      last_verification_sent_at: null,
    });
  }

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("messaging_endpoints")
    .update(updatePayload)
    .eq("id", endpointId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Messaging endpoint not found." }, { status: 404 });
  }

  return NextResponse.json({ data: mapDbMessagingEndpoint(data as DbMessagingEndpointRow) });
}
