import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../lib/supabase/route-auth";
import { processInboundMessage } from "../../../../../lib/messaging-service";
import {
  mapDbMessagingEndpoint,
  normalizeChannelAddress,
  normalizeMessagingEndpointInput,
  type DbMessagingEndpointRow,
} from "../../../../../lib/messaging-data";

type SimulateInboundRequest = {
  content?: string;
  fromAddress?: string;
  assistantAddress?: string;
  channelType?: "sms" | "test";
  providerKey?: string;
};

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as SimulateInboundRequest;
  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }

  const channelType = body.channelType ?? "test";
  const providerKey = body.providerKey ?? "simulator";
  const fromAddress =
    body.fromAddress ??
    (channelType === "sms" ? "+15555550123" : `dev-${auth.userId.slice(0, 8)}`);

  const normalizedAddress = normalizeChannelAddress(channelType, fromAddress);
  const { supabase, userId } = auth;

  const { data: existingEndpoint, error: endpointLookupError } = await supabase
    .from("messaging_endpoints")
    .select("*")
    .eq("user_id", userId)
    .eq("channel_type", channelType)
    .eq("address", normalizedAddress)
    .maybeSingle();

  if (endpointLookupError) {
    return NextResponse.json({ error: endpointLookupError.message }, { status: 500 });
  }

  let endpoint = existingEndpoint ? mapDbMessagingEndpoint(existingEndpoint as DbMessagingEndpointRow) : null;
  if (endpoint && (endpoint.verificationStatus !== "verified" || !endpoint.isActive)) {
    const { data: activatedEndpoint, error: activateError } = await supabase
      .from("messaging_endpoints")
      .update({
        is_active: true,
        is_preferred: true,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .eq("id", endpoint.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (activateError) {
      return NextResponse.json({ error: activateError.message }, { status: 500 });
    }

    endpoint = mapDbMessagingEndpoint(activatedEndpoint as DbMessagingEndpointRow);
  }

  if (!endpoint) {
    const payload = normalizeMessagingEndpointInput({
      channelType,
      providerKey,
      address: normalizedAddress,
      label: channelType === "sms" ? "Simulated SMS endpoint" : "Simulator endpoint",
    });

    const { data: createdEndpoint, error: createError } = await supabase
      .from("messaging_endpoints")
      .insert({
        user_id: userId,
        ...payload,
        is_active: true,
        is_preferred: true,
        verification_status: "verified",
        verified_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    endpoint = mapDbMessagingEndpoint(createdEndpoint as DbMessagingEndpointRow);
  }

  try {
    const result = await processInboundMessage({
      providerKey,
      channelType,
      participantAddress: endpoint.address,
      assistantAddress: body.assistantAddress,
      content,
      metadata: {
        simulated: true,
      },
      dispatchReply: false,
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to simulate inbound message.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
