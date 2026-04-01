import type {
  Automation,
  PlanningItem,
  ReminderPreference,
  SchoolClass,
  StudentNote,
  StudentTask,
} from "../types";
import { mapDbAutomation } from "./automations-data";
import type { DbAutomationRow } from "./automations-data";
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
import { mapDbPlanningItem } from "./planning-items";
import type { DbPlanningItemRow } from "./planning-items";
import { mapDbNoteToStudentNote } from "./notes-data";
import type { DbNoteRow } from "./notes-data";

export type AssistantDataBundle = {
  tasks: StudentTask[];
  classes: SchoolClass[];
  notes: StudentNote[];
  reminderPreferences: ReminderPreference;
  automations: Automation[];
  planningItems: PlanningItem[];
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

  const notesQuery = supabase
    .from("notes")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  const automationsQuery = supabase
    .from("automations")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const planningItemsQuery = supabase
    .from("planning_items")
    .select("*")
    .eq("user_id", userId)
    .eq("enabled", true)
    .order("kind", { ascending: true })
    .order("date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  const [
    { data: taskRows, error: taskError },
    { data: classRows, error: classError },
    { data: materialRows, error: materialError },
    { data: reminderRow, error: reminderError },
    { data: noteRows, error: notesError },
    { data: automationRows, error: automationError },
    { data: planningItemRows, error: planningItemsError },
  ] = await Promise.all([
    tasksQuery,
    classQuery,
    materialsQuery,
    reminderQuery,
    notesQuery,
    automationsQuery,
    planningItemsQuery,
  ]);

  if (
    taskError ||
    classError ||
    materialError ||
    reminderError ||
    notesError ||
    automationError ||
    planningItemsError
  ) {
    throw new Error(
      taskError?.message ??
        classError?.message ??
        materialError?.message ??
        reminderError?.message ??
        notesError?.message ??
        automationError?.message ??
        planningItemsError?.message ??
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
    notes: ((noteRows ?? []) as DbNoteRow[]).map(mapDbNoteToStudentNote),
    automations: ((automationRows ?? []) as DbAutomationRow[]).map(mapDbAutomation),
    planningItems: ((planningItemRows ?? []) as DbPlanningItemRow[]).map(mapDbPlanningItem),
    reminderPreferences: reminderRow
      ? mergeReminderPreferenceWithDefaults(
          mapDbReminderPreference(reminderRow as DbReminderPreferenceRow),
        )
      : DEFAULT_REMINDER_PREFERENCES,
  };
}
