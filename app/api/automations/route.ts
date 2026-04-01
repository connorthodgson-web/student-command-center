import { NextResponse } from "next/server";
import {
  mapAutomationToInsert,
  mapAutomationToUpdate,
  mapDbAutomation,
  type AutomationInsert,
  type AutomationUpdate,
  type DbAutomationRow,
} from "../../../lib/automations-data";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";

type CreateAutomationRequest = {
  automation?: AutomationInsert;
};

type UpdateAutomationRequest = {
  id?: string;
  updates?: AutomationUpdate;
};

type DeleteAutomationRequest = {
  id?: string;
};

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("automations")
    .select("*")
    .eq("user_id", userId)
    .order("enabled", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((data ?? []) as DbAutomationRow[]).map(mapDbAutomation),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as CreateAutomationRequest;

  if (!body.automation) {
    return NextResponse.json({ error: "Automation payload is required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("automations")
      .insert(mapAutomationToInsert(body.automation, userId))
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: mapDbAutomation(data as DbAutomationRow) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid automation payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as UpdateAutomationRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Automation id is required." }, { status: 400 });
  }

  if (!body.updates || Object.keys(body.updates).length === 0) {
    return NextResponse.json({ error: "Automation updates are required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("automations")
      .update(mapAutomationToUpdate(body.updates))
      .eq("id", body.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: mapDbAutomation(data as DbAutomationRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid automation updates.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as DeleteAutomationRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Automation id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("automations")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
