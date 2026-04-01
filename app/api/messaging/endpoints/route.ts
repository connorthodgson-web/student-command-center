import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../lib/supabase/route-auth";
import { buildMessagingReadiness } from "../../../../lib/messaging-readiness";
import {
  mapDbMessagingEndpoint,
  normalizeMessagingEndpointInput,
  type DbMessagingEndpointRow,
  type MessagingEndpointInput,
} from "../../../../lib/messaging-data";

type CreateEndpointRequest = {
  endpoint?: MessagingEndpointInput;
};

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("messaging_endpoints")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const endpoints = ((data ?? []) as DbMessagingEndpointRow[]).map(mapDbMessagingEndpoint);

  return NextResponse.json({
    data: endpoints,
    readiness: buildMessagingReadiness(endpoints),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as CreateEndpointRequest;

  if (!body.endpoint) {
    return NextResponse.json({ error: "Endpoint payload is required." }, { status: 400 });
  }

  try {
    const payload = normalizeMessagingEndpointInput(body.endpoint, { requireAddress: true });
    const { data: existing } = await supabase
      .from("messaging_endpoints")
      .select("*")
      .eq("user_id", userId)
      .eq("channel_type", payload.channel_type)
      .eq("address", payload.address)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { data: mapDbMessagingEndpoint(existing as DbMessagingEndpointRow) },
        { status: 200 },
      );
    }

    const { data, error } = await supabase
      .from("messaging_endpoints")
      .insert({
        user_id: userId,
        ...payload,
        is_active: false,
        is_preferred: false,
        verification_status: "not_started",
      })
      .select("*")
      .single();

    if (error) {
      const message =
        error.message.includes("messaging_endpoints_channel_address_idx")
          ? "That phone number is already linked to another account."
          : error.message;
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json(
      { data: mapDbMessagingEndpoint(data as DbMessagingEndpointRow) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid messaging endpoint payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
