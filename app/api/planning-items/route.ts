import { NextResponse } from "next/server";
import {
  mapDbPlanningItem,
  mapPlanningItemToInsert,
  mapPlanningItemToUpdate,
  type DbPlanningItemRow,
  type PlanningItemInsert,
  type PlanningItemUpdate,
} from "../../../lib/planning-items";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";

type CreatePlanningItemRequest = {
  item?: PlanningItemInsert;
};

type UpdatePlanningItemRequest = {
  id?: string;
  updates?: PlanningItemUpdate;
};

type DeletePlanningItemRequest = {
  id?: string;
};

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("planning_items")
    .select("*")
    .eq("user_id", userId)
    .order("kind", { ascending: true })
    .order("date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((data ?? []) as DbPlanningItemRow[]).map(mapDbPlanningItem),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as CreatePlanningItemRequest;

  if (!body.item) {
    return NextResponse.json({ error: "Planning item payload is required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("planning_items")
      .insert(mapPlanningItemToInsert(body.item, userId))
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: mapDbPlanningItem(data as DbPlanningItemRow) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid planning item payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as UpdatePlanningItemRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Planning item id is required." }, { status: 400 });
  }

  if (!body.updates || Object.keys(body.updates).length === 0) {
    return NextResponse.json({ error: "Planning item updates are required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("planning_items")
      .update(mapPlanningItemToUpdate(body.updates))
      .eq("id", body.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: mapDbPlanningItem(data as DbPlanningItemRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid planning item updates.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as DeletePlanningItemRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Planning item id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("planning_items")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
