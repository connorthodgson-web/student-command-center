import { NextResponse } from "next/server";
import { getAuthedSupabase } from "../../../../../lib/supabase/route-auth";
import { mapDbMessagingEndpoint, type DbMessagingEndpointRow } from "../../../../../lib/messaging-data";
import { setPreferredEndpoint } from "../../../../../lib/messaging-service";

type UpdateEndpointRequest = {
  isPreferred?: boolean;
  isActive?: boolean;
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

  if (typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "No supported endpoint updates were provided." }, { status: 400 });
  }

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("messaging_endpoints")
    .update({ is_active: body.isActive })
    .eq("id", endpointId)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Messaging endpoint not found." }, { status: 404 });
  }

  return NextResponse.json({ data: mapDbMessagingEndpoint(data as DbMessagingEndpointRow) });
}
