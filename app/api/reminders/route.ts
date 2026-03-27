import { NextResponse } from "next/server";
import {
  DEFAULT_REMINDER_PREFERENCES,
  mapDbReminderPreference,
  mergeReminderPreferenceWithDefaults,
  normalizeReminderPreferenceInput,
  type DbReminderPreferenceRow,
  type ReminderPreferenceInput,
} from "../../../lib/reminder-preferences-data";
import { getAuthedSupabase } from "../../../lib/supabase/route-auth";

type UpdateReminderRequest = {
  preferences?: ReminderPreferenceInput;
};

export async function GET() {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const { data, error } = await supabase
    .from("reminder_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const preferences = data
    ? mergeReminderPreferenceWithDefaults(
        mapDbReminderPreference(data as DbReminderPreferenceRow),
      )
    : { ...DEFAULT_REMINDER_PREFERENCES, userId };

  return NextResponse.json({ data: preferences });
}

export async function PUT(request: Request) {
  const auth = await getAuthedSupabase();
  if ("response" in auth) return auth.response;

  const { supabase, userId } = auth;
  const body = (await request.json()) as UpdateReminderRequest;

  if (!body.preferences) {
    return NextResponse.json(
      { error: "Reminder preferences payload is required." },
      { status: 400 },
    );
  }

  try {
    const payload = normalizeReminderPreferenceInput(body.preferences);
    const { data, error } = await supabase
      .from("reminder_preferences")
      .upsert(
        {
          user_id: userId,
          ...payload,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: mergeReminderPreferenceWithDefaults(
        mapDbReminderPreference(data as DbReminderPreferenceRow),
      ),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid reminder preferences payload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
