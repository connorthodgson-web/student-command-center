import type { ReminderPreference, SchoolClass, StudentTask } from "../types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapDbClassMaterial } from "./class-materials";
import type { DbClassMaterialRow } from "./class-materials";
import { mapDbClassToSchoolClass } from "./classes";
import type { DbClassRow } from "./classes";
import {
  DEFAULT_REMINDER_PREFERENCES,
  mapDbReminderPreference,
  mergeReminderPreferenceWithDefaults,
} from "./reminder-preferences-data";
import type { DbReminderPreferenceRow } from "./reminder-preferences-data";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import { mapDbTaskToStudentTask } from "./tasks-data";
import type { DbTaskRow } from "./tasks-data";

export type AssistantDataBundle = {
  tasks: StudentTask[];
  classes: SchoolClass[];
  reminderPreferences: ReminderPreference;
};

export async function loadAssistantData(options?: {
  classId?: string;
  includeCompletedTasks?: boolean;
  userId?: string;
  supabase?: SupabaseClient;
}): Promise<AssistantDataBundle | null> {
  const supabase =
    options?.supabase ??
    (options?.userId ? createAdminClient() : await createClient());
  if (!supabase) return null;

  const userId = options?.userId
    ? options.userId
    : await (async () => {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          return null;
        }

        return user.id;
      })();

  if (!userId) return null;

  const tasksQuery = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (!options?.includeCompletedTasks) {
    tasksQuery.neq("status", "done");
  }

  const classQuery = supabase
    .from("classes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const materialsQuery = options?.classId
    ? supabase
        .from("class_materials")
        .select("*")
        .eq("user_id", userId)
        .eq("class_id", options.classId)
        .order("created_at", { ascending: false })
    : supabase
        .from("class_materials")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

  const reminderQuery = supabase
    .from("reminder_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const [{ data: taskRows, error: taskError }, { data: classRows, error: classError }, { data: materialRows, error: materialError }, { data: reminderRow, error: reminderError }] =
    await Promise.all([tasksQuery, classQuery, materialsQuery, reminderQuery]);

  if (taskError || classError || materialError || reminderError) {
    throw new Error(
      taskError?.message ??
        classError?.message ??
        materialError?.message ??
        reminderError?.message ??
        "Failed to load assistant data.",
    );
  }

  const materialsByClassId = new Map<string, ReturnType<typeof mapDbClassMaterial>[]>();
  for (const row of (materialRows ?? []) as DbClassMaterialRow[]) {
    const material = mapDbClassMaterial(row);
    const list = materialsByClassId.get(material.classId) ?? [];
    list.push(material);
    materialsByClassId.set(material.classId, list);
  }

  const classes = ((classRows ?? []) as DbClassRow[]).map((row) => {
    const mapped = mapDbClassToSchoolClass(row);
    return {
      ...mapped,
      materials: materialsByClassId.get(mapped.id) ?? [],
    };
  });

  return {
    tasks: ((taskRows ?? []) as DbTaskRow[]).map(mapDbTaskToStudentTask),
    classes,
    reminderPreferences: reminderRow
      ? mergeReminderPreferenceWithDefaults(
          mapDbReminderPreference(reminderRow as DbReminderPreferenceRow),
        )
      : DEFAULT_REMINDER_PREFERENCES,
  };
}
