import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import type { Automation } from "../../../types";

// TODO: Create a `automations` table in Supabase with these columns:
//   id uuid primary key default gen_random_uuid()
//   user_id uuid references auth.users not null
//   type text not null
//   title text not null
//   schedule_description text not null
//   schedule_config jsonb not null default '{}'
//   enabled boolean not null default true
//   delivery_channel text not null default 'in_app'
//   related_class_id uuid references classes(id) on delete set null
//   related_task_id uuid
//   created_at timestamptz not null default now()
//   updated_at timestamptz not null default now()
//
// Until the table exists, these endpoints return stub responses so the UI
// and store can be built independently of database work.

async function getAuthedSupabase() {
  const supabase = await createClient();
  if (!supabase) {
    return { response: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, userId: user.id };
}

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  // TODO: Query the automations table once it exists.
  // const { data, error } = await auth.supabase
  //   .from("automations")
  //   .select("*")
  //   .eq("user_id", auth.userId)
  //   .order("created_at", { ascending: false });

  return NextResponse.json({ automations: [] });
}

export async function POST(req: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const automation = body as Omit<Automation, "id" | "userId" | "createdAt" | "updatedAt">;

  // TODO: Insert into Supabase automations table.
  // const { data, error } = await auth.supabase
  //   .from("automations")
  //   .insert({ ...automation, user_id: auth.userId })
  //   .select()
  //   .single();

  console.log("[automations] POST stub – would create:", automation);
  return NextResponse.json({ automation: null, stub: true }, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { id, updates } = body as { id?: string; updates?: Partial<Automation> };

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // TODO: Update the automations table.
  // const { data, error } = await auth.supabase
  //   .from("automations")
  //   .update({ ...updates, updated_at: new Date().toISOString() })
  //   .eq("id", id)
  //   .eq("user_id", auth.userId)
  //   .select()
  //   .single();

  console.log("[automations] PATCH stub – would update:", id, updates);
  return NextResponse.json({ automation: null, stub: true });
}

export async function DELETE(req: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // TODO: Delete from the automations table.
  // const { error } = await auth.supabase
  //   .from("automations")
  //   .delete()
  //   .eq("id", id)
  //   .eq("user_id", auth.userId);

  console.log("[automations] DELETE stub – would delete:", id);
  return NextResponse.json({ success: true, stub: true });
}
