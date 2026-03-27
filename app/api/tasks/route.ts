import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";
import {
  mapDbTaskToStudentTask,
  normalizeTaskInput,
  type DbTaskRow,
  type TaskMutationInput,
} from "../../../lib/tasks-data";

type CreateTaskRequest = {
  task?: TaskMutationInput;
};

type UpdateTaskRequest = {
  id?: string;
  updates?: TaskMutationInput;
};

type DeleteTaskRequest = {
  id?: string;
};

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data: ((data ?? []) as DbTaskRow[]).map(mapDbTaskToStudentTask),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as CreateTaskRequest;

  if (!body.task) {
    return NextResponse.json({ error: "Task payload is required." }, { status: 400 });
  }

  try {
    const payload = normalizeTaskInput(body.task, { requireTitle: true });

    if (payload.class_id && !(await classBelongsToUser(supabase, payload.class_id, userId))) {
      return NextResponse.json(
        { error: "The selected class does not belong to this user." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        status: "todo",
        source: "manual",
        ...payload,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: mapDbTaskToStudentTask(data as DbTaskRow) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid task payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as UpdateTaskRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Task id is required." }, { status: 400 });
  }

  if (!body.updates || Object.keys(body.updates).length === 0) {
    return NextResponse.json({ error: "Task updates are required." }, { status: 400 });
  }

  try {
    const payload = normalizeTaskInput(body.updates);

    if (payload.class_id && !(await classBelongsToUser(supabase, payload.class_id, userId))) {
      return NextResponse.json(
        { error: "The selected class does not belong to this user." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(payload)
      .eq("id", body.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: mapDbTaskToStudentTask(data as DbTaskRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid task payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as DeleteTaskRequest;

  if (!body.id) {
    return NextResponse.json({ error: "Task id is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", body.id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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
