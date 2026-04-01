import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";
import {
  mapDbNoteToStudentNote,
  normalizeNoteInput,
  type DbNoteRow,
  type NoteMutationInput,
} from "../../../lib/notes-data";

type CreateNoteRequest = {
  note?: NoteMutationInput;
};

type UpdateNoteRequest = {
  id?: string;
  updates?: NoteMutationInput;
};

type DeleteNoteRequest = {
  id?: string;
};

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((data ?? []) as DbNoteRow[]).map(mapDbNoteToStudentNote),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as CreateNoteRequest;

  if (!body.note) {
    return NextResponse.json({ error: "Note payload is required." }, { status: 400 });
  }

  try {
    const payload = normalizeNoteInput(body.note, { requireContent: true });

    if (payload.class_id && !(await classBelongsToUser(supabase, payload.class_id, userId))) {
      return NextResponse.json(
        { error: "The selected class does not belong to this user." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        ...payload,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: mapDbNoteToStudentNote(data as DbNoteRow) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid note payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as UpdateNoteRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Note id is required." }, { status: 400 });
  }

  if (!body.updates || Object.keys(body.updates).length === 0) {
    return NextResponse.json({ error: "Note updates are required." }, { status: 400 });
  }

  try {
    const payload = normalizeNoteInput(body.updates);

    if (payload.class_id && !(await classBelongsToUser(supabase, payload.class_id, userId))) {
      return NextResponse.json(
        { error: "The selected class does not belong to this user." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("notes")
      .update(payload)
      .eq("id", body.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Note not found." }, { status: 404 });
    }

    return NextResponse.json({ data: mapDbNoteToStudentNote(data as DbNoteRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid note updates.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as DeleteNoteRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Note id is required." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("notes")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

async function classBelongsToUser(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  classId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("user_id", userId)
    .maybeSingle();

  return !error && Boolean(data);
}
