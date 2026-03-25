import { NextResponse } from "next/server";
import {
  mapDbClassToSchoolClass,
  mapSchoolClassToInsert,
  mapSchoolClassToUpdate,
} from "../../../lib/classes";
import { createClient } from "../../../lib/supabase/server";
import type { SchoolClass } from "../../../types";

type CreateClassesRequest = {
  classes?: Array<Omit<SchoolClass, "id">>;
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

  const rows = classes.map((schoolClass) => mapSchoolClassToInsert(schoolClass, userId));
  const { data, error } = await supabase.from("classes").insert(rows).select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { data: (data ?? []).map(mapDbClassToSchoolClass) },
    { status: 201 }
  );
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

  const { data, error } = await supabase
    .from("classes")
    .update(mapSchoolClassToUpdate(body.updates))
    .eq("id", body.id)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: mapDbClassToSchoolClass(data) });
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

async function getAuthedSupabase() {
  const supabase = await createClient();

  if (!supabase) {
    return {
      response: NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 }
      ),
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { supabase, userId: user.id };
}
