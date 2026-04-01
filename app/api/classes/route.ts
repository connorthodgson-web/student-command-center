import { NextResponse } from "next/server";
import {
  mapDbClassToSchoolClass,
  mapSchoolClassToInsert,
  mapSchoolClassToUpdate,
  normalizeSchoolClassInput,
} from "../../../lib/classes";
import { saveParsedSchedule } from "../../../lib/assistant-action-executor";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";
import type { SchoolClass } from "../../../types";

type CreateClassesRequest = {
  classes?: Array<Omit<SchoolClass, "id">>;
  importMode?: "safe_schedule";
};

type UpdateClassRequest = {
  id?: string;
  updates?: Partial<Omit<SchoolClass, "id">>;
};

type DeleteClassRequest = {
  id?: string;
};

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: (data ?? []).map(mapDbClassToSchoolClass) });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as CreateClassesRequest;
  const classes = body.classes ?? [];

  if (classes.length === 0) {
    return NextResponse.json({ error: "At least one class is required." }, { status: 400 });
  }

  try {
    if (body.importMode === "safe_schedule") {
      const normalizedClasses = classes.map((schoolClass) =>
        normalizeSchoolClassInput(schoolClass, { requireName: true }),
      );
      const result = await saveParsedSchedule({
        supabase,
        userId,
        classes: normalizedClasses,
      });

      return NextResponse.json({
        data: [...result.created, ...result.updated],
        importSummary: {
          created: result.created.length,
          updated: result.updated.length,
          skipped: result.skipped.length,
          ambiguous: result.ambiguous.length,
          partial: result.partial.length,
        },
      });
    }

    const rows = classes.map((schoolClass) =>
      mapSchoolClassToInsert(normalizeSchoolClassInput(schoolClass, { requireName: true }), userId),
    );
    const { data, error } = await supabase.from("classes").insert(rows).select("*");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: (data ?? []).map(mapDbClassToSchoolClass) },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid class payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as UpdateClassRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Class id is required." }, { status: 400 });
  }

  if (!body.updates || Object.keys(body.updates).length === 0) {
    return NextResponse.json({ error: "Class updates are required." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("classes")
      .update(mapSchoolClassToUpdate(normalizeSchoolClassInput(body.updates)))
      .eq("id", body.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: mapDbClassToSchoolClass(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid class updates.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as DeleteClassRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Class id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
