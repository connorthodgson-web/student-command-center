import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAutomationToInsert,
  mapAutomationToUpdate,
  mapDbAutomation,
} from "./automations-data";
import {
  mapDbClassToSchoolClass,
  mapSchoolClassToInsert,
  mapSchoolClassToUpdate,
} from "./classes";
import { mapDbNoteToStudentNote, matchNote, normalizeNoteInput, type DbNoteRow } from "./notes-data";
import {
  mapDbPlanningItem,
  mapPlanningItemToInsert,
  mapPlanningItemToUpdate,
  type DbPlanningItemRow,
} from "./planning-items";
import { mapDbTaskToStudentTask, normalizeTaskInput, type DbTaskRow } from "./tasks-data";
import type {
  AssistantAction,
  Automation,
  ChatMessageActionResult,
  PlanningItem,
  PlanningItemKind,
  SchoolClass,
  StudentNote,
  StudentTask,
} from "../types";

export type AssistantSyncTarget =
  | "tasks"
  | "classes"
  | "notes"
  | "planningItems"
  | "automations";

type ExecutionStatus =
  | "completed"
  | "failed"
  | "ambiguous"
  | "not_found"
  | "skipped";

export type ExecuteAssistantActionResult = {
  content: string;
  sync: AssistantSyncTarget[];
  actionResult?: ChatMessageActionResult;
  status: ExecutionStatus;
};

type ExecuteAssistantActionInput = {
  supabase: SupabaseClient;
  userId: string;
  action?: AssistantAction;
  assistantContent: string;
  tasks: StudentTask[];
  classes: SchoolClass[];
  automations: Automation[];
  notes: StudentNote[];
  planningItems: PlanningItem[];
  responseFormat?: "web" | "plain";
};

export async function executeAssistantAction({
  supabase,
  userId,
  action,
  assistantContent,
  tasks,
  classes,
  automations,
  notes,
  planningItems,
  responseFormat = "web",
}: ExecuteAssistantActionInput): Promise<ExecuteAssistantActionResult> {
  if (!action) {
    return {
      content: assistantContent,
      sync: [],
      status: "skipped",
    };
  }

  switch (action.type) {
    case "create_automation": {
      try {
        const { data, error } = await supabase
          .from("automations")
          .insert(
            mapAutomationToInsert(
              {
                type: action.automation.type,
                title: action.automation.title,
                scheduleDescription: action.automation.scheduleDescription,
                scheduleConfig: action.automation.scheduleConfig,
                enabled: action.automation.enabled,
                deliveryChannel: action.automation.deliveryChannel,
                relatedClassId: action.automation.relatedClassId,
                relatedTaskId: action.automation.relatedTaskId,
              },
              userId,
            ),
          )
          .select("*")
          .single();

        if (error || !data) {
          return {
            content:
              `${assistantContent.trimEnd()}\n\n` +
              `(I understood the reminder, but I ran into an issue saving it. Please try again in ${formatDestinationReference("Automations", "/automations", responseFormat)}.)`,
            sync: [],
            status: "failed",
          };
        }

        mapDbAutomation(data);
        return {
          content:
            `${assistantContent.trimEnd()}\n\n` +
            `Saved to your ${formatDestinationReference("Automations", "/automations", responseFormat)}.`,
          sync: ["automations"],
          status: "completed",
        };
      } catch {
        return {
          content:
            `${assistantContent.trimEnd()}\n\n` +
            `(I understood the reminder, but I ran into an issue saving it. Please try again in ${formatDestinationReference("Automations", "/automations", responseFormat)}.)`,
          sync: [],
          status: "failed",
        };
      }
    }

    case "update_automation": {
      const { match, ambiguous, candidates } = matchAutomation(
        automations,
        action.automationId,
        action.automationTitle,
      );

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatAutomationCandidate).join("\n");
        return {
          content: `I found a few reminders or automations that could match - which one did you mean?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const automationLabel = action.automationTitle ? `"${action.automationTitle}"` : "that reminder";
        return {
          content: `I couldn't find ${automationLabel} in your saved automations. Can you describe it a little differently?`,
          sync: [],
          status: "not_found",
        };
      }

      let relatedClassId: string | null | undefined;
      let classUpdateMessage = "";
      if (action.updates.relatedClassName !== undefined) {
        if (action.updates.relatedClassName === null) {
          relatedClassId = null;
        } else {
          const classMatch = resolveClassMatch(classes, action.updates.relatedClassName);
          relatedClassId = classMatch.id ?? match.relatedClassId ?? null;
          classUpdateMessage = formatAutomationClassUpdateSuffix(
            classMatch,
            action.updates.relatedClassName,
          );
        }
      }

      try {
        const originalTitle = match.title;
        const { data, error } = await supabase
          .from("automations")
          .update(
            mapAutomationToUpdate({
              ...(action.updates.type !== undefined ? { type: action.updates.type } : {}),
              ...(action.updates.title !== undefined ? { title: action.updates.title } : {}),
              ...(action.updates.scheduleDescription !== undefined
                ? { scheduleDescription: action.updates.scheduleDescription }
                : {}),
              ...(action.updates.scheduleConfig !== undefined
                ? { scheduleConfig: action.updates.scheduleConfig }
                : {}),
              ...(action.updates.deliveryChannel !== undefined
                ? { deliveryChannel: action.updates.deliveryChannel }
                : {}),
              ...(action.updates.enabled !== undefined ? { enabled: action.updates.enabled } : {}),
              ...(action.updates.relatedClassName !== undefined
                ? { relatedClassId: relatedClassId ?? undefined }
                : {}),
              ...(action.updates.relatedTaskId !== undefined
                ? { relatedTaskId: action.updates.relatedTaskId ?? undefined }
                : {}),
            }),
          )
          .eq("id", match.id)
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();

        if (error || !data) {
          return {
            content:
              `I found **${match.title}**, but I ran into an issue saving that reminder change. Please try again or edit it in ${formatDestinationReference("Automations", "/automations", responseFormat)}.`,
            sync: [],
            status: "failed",
          };
        }

        const patched = mapDbAutomation(data);
        const changeParts = formatAutomationUpdateSummary(patched, originalTitle, action.updates);

        return {
          content:
            changeParts.length > 0
              ? `Updated your reminder - **${patched.title}**: ${changeParts.join(", ")}.${classUpdateMessage}`
              : `Updated your reminder - **${patched.title}** is saved.${classUpdateMessage}`,
          sync: ["automations"],
          status: "completed",
        };
      } catch {
        return {
          content:
            `I found **${match.title}**, but I ran into an issue saving that reminder change. Please try again or edit it in ${formatDestinationReference("Automations", "/automations", responseFormat)}.`,
          sync: [],
          status: "failed",
        };
      }
    }

    case "delete_automation": {
      const { match, ambiguous, candidates } = matchAutomation(
        automations,
        action.automationId,
        action.automationTitle,
      );

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatAutomationCandidate).join("\n");
        return {
          content: `I found a few reminders or automations that could match - which one should I remove?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const automationLabel = action.automationTitle ? `"${action.automationTitle}"` : "that reminder";
        return {
          content: `I couldn't find ${automationLabel} in your saved automations. Can you describe it a little differently?`,
          sync: [],
          status: "not_found",
        };
      }

      const { data, error } = await supabase
        .from("automations")
        .delete()
        .eq("id", match.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return {
          content:
            `I found **${match.title}**, but I couldn't remove it right now. Please try again or delete it in ${formatDestinationReference("Automations", "/automations", responseFormat)}.`,
          sync: [],
          status: "failed",
        };
      }

      return {
        content: `Done - I removed **${match.title}** from your automations.`,
        sync: ["automations"],
        status: "completed",
      };
    }

    case "create_planning_item": {
      try {
        const { data, error } = await supabase
          .from("planning_items")
          .insert(
            mapPlanningItemToInsert(
              {
                kind: action.item.kind,
                title: action.item.title,
                daysOfWeek: action.item.daysOfWeek,
                date: action.item.date,
                startTime: action.item.startTime ?? undefined,
                endTime: action.item.endTime ?? undefined,
                location: action.item.location ?? undefined,
                notes: action.item.notes ?? undefined,
                isAllDay: action.item.isAllDay ?? false,
                enabled: action.item.enabled ?? true,
              },
              userId,
            ),
          )
          .select("*")
          .single();

        if (error || !data) {
          return {
            content:
              `${assistantContent.trimEnd()}\n\n` +
              `(I couldn't save that planning item automatically. Try again in ${formatDestinationReference("Activities", "/activities", responseFormat)}.)`,
            sync: [],
            status: "failed",
          };
        }

        mapDbPlanningItem(data as DbPlanningItemRow);
        return {
          content:
            `${assistantContent.trimEnd()}\n\n` +
            `Saved to your ${formatDestinationReference("Activities", "/activities", responseFormat)}.`,
          sync: ["planningItems"],
          status: "completed",
        };
      } catch {
        return {
          content:
            `${assistantContent.trimEnd()}\n\n` +
            `(I couldn't save that planning item automatically. Try again in ${formatDestinationReference("Activities", "/activities", responseFormat)}.)`,
          sync: [],
          status: "failed",
        };
      }
    }

    case "update_planning_item": {
      const { match, ambiguous, candidates } = matchPlanningItem(
        planningItems,
        action.itemId,
        action.itemTitle,
        action.itemKind,
      );

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatPlanningCandidate).join("\n");
        return {
          content:
            `I found a few saved activities or events that could match - which one did you mean?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const itemLabel = action.itemTitle ? `"${action.itemTitle}"` : "that item";
        return {
          content:
            `I couldn't find ${itemLabel} in your saved activities or events. Can you describe it a little differently?`,
          sync: [],
          status: "not_found",
        };
      }

      try {
        const originalTitle = match.title;
        const { data, error } = await supabase
          .from("planning_items")
          .update(
            mapPlanningItemToUpdate({
              ...(action.updates.kind !== undefined ? { kind: action.updates.kind } : {}),
              ...(action.updates.title !== undefined ? { title: action.updates.title } : {}),
              ...(action.updates.daysOfWeek !== undefined
                ? { daysOfWeek: action.updates.daysOfWeek }
                : {}),
              ...(action.updates.date !== undefined ? { date: action.updates.date } : {}),
              ...(action.updates.startTime !== undefined
                ? { startTime: action.updates.startTime }
                : {}),
              ...(action.updates.endTime !== undefined ? { endTime: action.updates.endTime } : {}),
              ...(action.updates.location !== undefined
                ? { location: action.updates.location }
                : {}),
              ...(action.updates.notes !== undefined ? { notes: action.updates.notes } : {}),
              ...(action.updates.isAllDay !== undefined
                ? { isAllDay: action.updates.isAllDay }
                : {}),
              ...(action.updates.enabled !== undefined ? { enabled: action.updates.enabled } : {}),
            }),
          )
          .eq("id", match.id)
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();

        if (error || !data) {
          return {
            content:
              `I found **${match.title}**, but I ran into an issue saving that change. Please try again or edit it in ${formatDestinationReference("Activities", "/activities", responseFormat)}.`,
            sync: [],
            status: "failed",
          };
        }

        const patched = mapDbPlanningItem(data as DbPlanningItemRow);
        const changeParts = formatPlanningUpdateSummary(patched, originalTitle, action.updates);
        const kindLabel = formatPlanningKindLabel(patched.kind);

        return {
          content:
            changeParts.length > 0
              ? `Updated your ${kindLabel} - **${patched.title}**: ${changeParts.join(", ")}.`
              : `Updated your ${kindLabel} - **${patched.title}** is saved.`,
          sync: ["planningItems"],
          status: "completed",
        };
      } catch {
        return {
          content:
            `I found **${match.title}**, but I ran into an issue saving that change. Please try again or edit it in ${formatDestinationReference("Activities", "/activities", responseFormat)}.`,
          sync: [],
          status: "failed",
        };
      }
    }

    case "delete_planning_item": {
      const { match, ambiguous, candidates } = matchPlanningItem(
        planningItems,
        action.itemId,
        action.itemTitle,
        action.itemKind,
      );

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatPlanningCandidate).join("\n");
        return {
          content:
            `I found a few saved activities or events that could match - which one should I remove?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const itemLabel = action.itemTitle ? `"${action.itemTitle}"` : "that item";
        return {
          content:
            `I couldn't find ${itemLabel} in your saved activities or events. Can you describe it a little differently?`,
          sync: [],
          status: "not_found",
        };
      }

      const { data, error } = await supabase
        .from("planning_items")
        .delete()
        .eq("id", match.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return {
          content:
            `I found **${match.title}**, but I couldn't remove it right now. Please try again or delete it in ${formatDestinationReference("Activities", "/activities", responseFormat)}.`,
          sync: [],
          status: "failed",
        };
      }

      return {
        content: `Done - I removed **${match.title}** from your ${formatPlanningKindLabel(match.kind)} list.`,
        sync: ["planningItems"],
        status: "completed",
      };
    }

    case "add_note": {
      const classMatch = resolveClassMatch(classes, action.note.className);

      try {
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: userId,
            ...normalizeNoteInput(
              {
                content: action.note.content,
                title: action.note.title ?? undefined,
                classId: classMatch.id,
              },
              { requireContent: true },
            ),
          })
          .select("*")
          .single();

        if (error || !data) {
          return {
            content: "I understood the note, but I ran into an issue saving it. Please try again.",
            sync: [],
            status: "failed",
          };
        }

        const savedNote = mapDbNoteToStudentNote(data as DbNoteRow);
        return {
          content:
            `Done - I saved that to your Memory${savedNote.title ? ` as **${savedNote.title}**` : ""}.` +
            formatUnresolvedClassSuffix(classMatch, action.note.className),
          sync: ["notes"],
          status: "completed",
        };
      } catch {
        return {
          content: "I understood the note, but I ran into an issue saving it. Please try again.",
          sync: [],
          status: "failed",
        };
      }
    }

    case "update_note": {
      const { match, ambiguous, candidates } = matchNote(notes, {
        noteId: action.noteId,
        noteTitle: action.noteTitle,
        noteContent: action.noteContent,
      });

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatNoteCandidate).join("\n");
        return {
          content: `I found a few notes that could match - which one did you mean?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        return {
          content: "I couldn't find that note in your saved memory. Can you quote a bit of it for me?",
          sync: [],
          status: "not_found",
        };
      }

      let classId: string | null | undefined;
      let classUpdateMessage = "";
      if (action.updates.className !== undefined) {
        if (action.updates.className === null) {
          classId = null;
        } else {
          const classMatch = resolveClassMatch(classes, action.updates.className);
          classId = classMatch.id ?? match.classId ?? null;
          classUpdateMessage = formatNoteClassUpdateSuffix(classMatch, action.updates.className);
        }
      }

      try {
        const { data, error } = await supabase
          .from("notes")
          .update(
            normalizeNoteInput({
              ...(action.updates.content !== undefined ? { content: action.updates.content } : {}),
              ...(action.updates.title !== undefined ? { title: action.updates.title } : {}),
              ...(action.updates.className !== undefined ? { classId } : {}),
            }),
          )
          .eq("id", match.id)
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();

        if (error || !data) {
          return {
            content: "I found that note, but I ran into an issue saving the update. Please try again.",
            sync: [],
            status: "failed",
          };
        }

        const patched = mapDbNoteToStudentNote(data as DbNoteRow);
        const changeParts = formatNoteUpdateSummary(patched, {
          content: action.updates.content,
          title: action.updates.title,
        });

        return {
          content:
            changeParts.length > 0
              ? `Updated your memory${patched.title ? ` - **${patched.title}**` : ""}: ${changeParts.join(", ")}.${classUpdateMessage}`
              : `Updated your memory${patched.title ? ` - **${patched.title}**` : ""}.${classUpdateMessage}`,
          sync: ["notes"],
          status: "completed",
        };
      } catch {
        return {
          content: "I found that note, but I ran into an issue saving the update. Please try again.",
          sync: [],
          status: "failed",
        };
      }
    }

    case "delete_note": {
      const { match, ambiguous, candidates } = matchNote(notes, {
        noteId: action.noteId,
        noteTitle: action.noteTitle,
        noteContent: action.noteContent,
      });

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatNoteCandidate).join("\n");
        return {
          content: `I found a few notes that could match - which one should I delete?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        return {
          content:
            "I couldn't find that note in your saved memory. Can you describe it a little differently?",
          sync: [],
          status: "not_found",
        };
      }

      const { data, error } = await supabase
        .from("notes")
        .delete()
        .eq("id", match.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return {
          content: "I found that note, but I couldn't delete it right now. Please try again.",
          sync: [],
          status: "failed",
        };
      }

      return {
        content: `Done - I removed that from your Memory${match.title ? ` (**${match.title}**)` : ""}.`,
        sync: ["notes"],
        status: "completed",
      };
    }

    case "update_class": {
      const { match, ambiguous, candidates } = matchClass(classes, action.classId, action.className);

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatClassCandidate).join("\n");
        return {
          content: `I found a few classes that could match - which one did you mean?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const classLabel = action.className ? `"${action.className}"` : "that class";
        return {
          content: `I couldn't find ${classLabel} in your saved classes. Can you describe it a little differently?`,
          sync: [],
          status: "not_found",
        };
      }

      try {
        const originalName = match.name;
        const { data, error } = await supabase
          .from("classes")
          .update(
            mapSchoolClassToUpdate({
              ...(action.updates.name !== undefined ? { name: action.updates.name } : {}),
              ...(action.updates.teacherName !== undefined
                ? { teacherName: action.updates.teacherName ?? undefined }
                : {}),
              ...(action.updates.teacherEmail !== undefined
                ? { teacherEmail: action.updates.teacherEmail ?? undefined }
                : {}),
              ...(action.updates.room !== undefined ? { room: action.updates.room ?? undefined } : {}),
              ...(action.updates.color !== undefined ? { color: action.updates.color ?? undefined } : {}),
              ...(action.updates.days !== undefined ? { days: action.updates.days ?? [] } : {}),
              ...(action.updates.startTime !== undefined
                ? { startTime: action.updates.startTime ?? undefined }
                : {}),
              ...(action.updates.endTime !== undefined
                ? { endTime: action.updates.endTime ?? undefined }
                : {}),
              ...(action.updates.rotationDays !== undefined
                ? { rotationDays: action.updates.rotationDays ?? undefined }
                : {}),
              ...(action.updates.scheduleLabel !== undefined
                ? { scheduleLabel: action.updates.scheduleLabel ?? undefined }
                : {}),
              ...(action.updates.notes !== undefined ? { notes: action.updates.notes ?? undefined } : {}),
              ...(action.updates.syllabusText !== undefined
                ? { syllabusText: action.updates.syllabusText ?? undefined }
                : {}),
              ...(action.updates.classNotes !== undefined
                ? { classNotes: action.updates.classNotes ?? undefined }
                : {}),
              ...(action.updates.isApCourse !== undefined
                ? { isApCourse: action.updates.isApCourse ?? undefined }
                : {}),
              ...(action.updates.apCourseKey !== undefined
                ? { apCourseKey: action.updates.apCourseKey }
                : {}),
            }),
          )
          .eq("id", match.id)
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();

        if (error || !data) {
          return {
            content:
              `I found **${match.name}**, but I ran into an issue saving that class change. Please try again or edit it in ${formatDestinationReference("Classes", "/classes", responseFormat)}.`,
            sync: [],
            status: "failed",
          };
        }

        const patched = mapDbClassToSchoolClass(data);
        const changeParts = formatClassUpdateSummary(patched, originalName, action.updates);

        return {
          content:
            changeParts.length > 0
              ? `Updated your class - **${patched.name}**: ${changeParts.join(", ")}.`
              : `Updated your class - **${patched.name}** is saved.`,
          sync: ["classes"],
          status: "completed",
        };
      } catch {
        return {
          content:
            `I found **${match.name}**, but I ran into an issue saving that class change. Please try again or edit it in ${formatDestinationReference("Classes", "/classes", responseFormat)}.`,
          sync: [],
          status: "failed",
        };
      }
    }

    case "delete_class": {
      const { match, ambiguous, candidates } = matchClass(classes, action.classId, action.className);

      if (ambiguous) {
        const list = candidates.slice(0, 5).map(formatClassCandidate).join("\n");
        return {
          content: `I found a few classes that could match - which one should I remove?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const classLabel = action.className ? `"${action.className}"` : "that class";
        return {
          content: `I couldn't find ${classLabel} in your saved classes. Can you describe it a little differently?`,
          sync: [],
          status: "not_found",
        };
      }

      const { data, error } = await supabase
        .from("classes")
        .delete()
        .eq("id", match.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return {
          content:
            `I found **${match.name}**, but I couldn't remove it right now. Please try again or delete it in ${formatDestinationReference("Classes", "/classes", responseFormat)}.`,
          sync: [],
          status: "failed",
        };
      }

      return {
        content: `Done - I removed **${match.name}** from your classes.`,
        sync: ["classes"],
        status: "completed",
      };
    }

    case "complete_task": {
      const { match, ambiguous, candidates } = matchTask(tasks, action.taskId, action.taskTitle);

      if (ambiguous) {
        const list = candidates.slice(0, 5).map((task) => `- ${task.title}`).join("\n");
        return {
          content: `I found a few tasks that could match - which one did you finish?\n\n${list}`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const taskLabel = action.taskTitle ? `"${action.taskTitle}"` : "that task";
        return {
          content: `I couldn't find ${taskLabel} in your task list. Can you give me a bit more detail?`,
          sync: [],
          status: "not_found",
        };
      }

      const { data, error } = await supabase
        .from("tasks")
        .update({ status: "done" })
        .eq("id", match.id)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();

      if (error || !data) {
        return {
          content: `I found **${match.title}** but ran into an issue marking it complete. Please try again or update it in Tasks.`,
          sync: [],
          status: "failed",
        };
      }

      mapDbTaskToStudentTask(data as DbTaskRow);
      return {
        content: `Done - I marked **${match.title}** as complete.`,
        sync: ["tasks"],
        status: "completed",
      };
    }

    case "update_task": {
      const { match, ambiguous, candidates } = matchTask(tasks, action.taskId, action.taskTitle);

      if (ambiguous) {
        const list = candidates
          .slice(0, 4)
          .map((task) => `- **${task.title}**`)
          .join("\n");
        return {
          content:
            `I found a few tasks that could match - which one did you mean?\n\n${list}\n\nJust tell me which one and I'll update it.`,
          sync: [],
          status: "ambiguous",
        };
      }

      if (!match) {
        const taskLabel = action.taskTitle ? `"${action.taskTitle}"` : "that task";
        return {
          content: `I couldn't find ${taskLabel} in your task list. Can you describe it differently?`,
          sync: [],
          status: "not_found",
        };
      }

      try {
        const { data, error } = await supabase
          .from("tasks")
          .update(
            normalizeTaskInput({
              ...(action.updates.title !== undefined ? { title: action.updates.title } : {}),
              ...(action.updates.dueAt !== undefined
                ? { dueAt: action.updates.dueAt ?? undefined }
                : {}),
              ...(action.updates.description !== undefined
                ? { description: action.updates.description ?? undefined }
                : {}),
              ...(action.updates.status !== undefined ? { status: action.updates.status } : {}),
            }),
          )
          .eq("id", match.id)
          .eq("user_id", userId)
          .select("*")
          .maybeSingle();

        if (error || !data) {
          return {
            content: `I found **${match.title}** but ran into an issue saving the update. Please try again or edit it directly in Tasks.`,
            sync: [],
            status: "failed",
          };
        }

        const patched = mapDbTaskToStudentTask(data as DbTaskRow);
        const changeParts: string[] = [];

        if (action.updates.title && patched.title !== match.title) {
          changeParts.push(`renamed to **${patched.title}**`);
        }
        if (action.updates.dueAt !== undefined) {
          changeParts.push(
            patched.dueAt
              ? `due date moved to **${formatTaskDueDate(patched.dueAt)}**`
              : "due date cleared",
          );
        }
        if (action.updates.description !== undefined) {
          changeParts.push("notes updated");
        }
        if (action.updates.status) {
          changeParts.push(`status set to **${action.updates.status}**`);
        }

        return {
          content:
            changeParts.length > 0
              ? `Updated - **${patched.title}**: ${changeParts.join(", ")}.`
              : `Updated **${patched.title}** - saved to your tasks.`,
          sync: ["tasks"],
          actionResult: {
            type: "task_updated",
            title: patched.title,
            dueAt: patched.dueAt,
          },
          status: "completed",
        };
      } catch {
        return {
          content: `I found **${match.title}** but ran into an issue saving the update. Please try again or edit it directly in Tasks.`,
          sync: [],
          status: "failed",
        };
      }
    }

    case "add_task": {
      const classMatch = resolveClassMatch(classes, action.task.className);

      try {
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            user_id: userId,
            ...normalizeTaskInput(
              {
                title: action.task.title,
                dueAt: action.task.dueAt ?? undefined,
                description: action.task.description ?? undefined,
                type: action.task.type ?? undefined,
                classId: classMatch.id,
                source: "chat",
                status: "todo",
              },
              { requireTitle: true },
            ),
          })
          .select("*")
          .single();

        if (error || !data) {
          return {
            content:
              "I understood the task, but I ran into an issue saving it. Please try again or add it from Tasks.",
            sync: [],
            status: "failed",
          };
        }

        const savedTask = mapDbTaskToStudentTask(data as DbTaskRow);
        return {
          content:
            `Done - I added **${savedTask.title}** to your tasks.` +
            formatUnresolvedClassSuffix(classMatch, action.task.className),
          sync: ["tasks"],
          actionResult: {
            type: "task_added",
            title: savedTask.title,
            dueAt: savedTask.dueAt,
          },
          status: "completed",
        };
      } catch {
        return {
          content:
            "I understood the task, but I ran into an issue saving it. Please try again or add it from Tasks.",
          sync: [],
          status: "failed",
        };
      }
    }

    case "setup_schedule":
      return {
        content: assistantContent,
        sync: [],
        status: "skipped",
      };
  }
}

export async function saveParsedSchedule(params: {
  supabase: SupabaseClient;
  userId: string;
  classes: Array<Omit<SchoolClass, "id">>;
}) {
  const { data: existingRows, error: existingError } = await params.supabase
    .from("classes")
    .select("*")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: true });

  if (existingError) {
    throw existingError;
  }

  const existingClasses = (existingRows ?? []).map(mapDbClassToSchoolClass);
  const created: SchoolClass[] = [];
  const updated: SchoolClass[] = [];
  const skipped: SchoolClass[] = [];
  const ambiguous: Array<{ className: string; candidates: SchoolClass[] }> = [];
  const partial: Array<{ className: string; missing: string[] }> = [];

  for (const parsedClass of params.classes) {
    const missing = getParsedScheduleMissingFields(parsedClass);
    if (missing.length > 0) {
      partial.push({ className: parsedClass.name, missing });
    }

    const match = findScheduleImportMatch(existingClasses, parsedClass);

    if (match?.mode === "skip") {
      skipped.push(match.existing);
      continue;
    }

    if (match?.mode === "ambiguous") {
      ambiguous.push({
        className: parsedClass.name,
        candidates: match.candidates,
      });
      continue;
    }

    if (match?.mode === "update") {
      const mergedClass = mergeImportedClass(match.existing, parsedClass);
      const { data, error } = await params.supabase
        .from("classes")
        .update(mapSchoolClassToUpdate(mergedClass))
        .eq("id", match.existing.id)
        .eq("user_id", params.userId)
        .select("*")
        .maybeSingle();

      if (error || !data) {
        throw error ?? new Error("Failed to update imported class.");
      }

      const saved = mapDbClassToSchoolClass(data);
      replaceClassInList(existingClasses, saved);
      updated.push(saved);
      continue;
    }

    const { data, error } = await params.supabase
      .from("classes")
      .insert(mapSchoolClassToInsert(parsedClass, params.userId))
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("Failed to create imported class.");
    }

    const saved = mapDbClassToSchoolClass(data);
    existingClasses.push(saved);
    created.push(saved);
  }

  return { created, updated, skipped, ambiguous, partial };
}

function matchTask(
  tasks: StudentTask[],
  taskId?: string,
  taskTitle?: string,
): { match: StudentTask | null; ambiguous: boolean; candidates: StudentTask[] } {
  const active = tasks.filter((task) => task.status !== "done");

  if (taskId) {
    const byId = active.find((task) => task.id === taskId);
    if (byId) {
      return { match: byId, ambiguous: false, candidates: [byId] };
    }
  }

  if (!taskTitle) {
    return { match: null, ambiguous: false, candidates: [] };
  }

  const needle = taskTitle.trim().toLowerCase();
  const exactMatches = active.filter((task) => task.title.toLowerCase() === needle);
  if (exactMatches.length === 1) {
    return { match: exactMatches[0], ambiguous: false, candidates: exactMatches };
  }
  if (exactMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: exactMatches };
  }

  const containsMatches = active.filter(
    (task) =>
      task.title.toLowerCase().includes(needle) || needle.includes(task.title.toLowerCase()),
  );
  if (containsMatches.length === 1) {
    return { match: containsMatches[0], ambiguous: false, candidates: containsMatches };
  }
  if (containsMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: containsMatches };
  }

  return { match: null, ambiguous: false, candidates: [] };
}

function matchPlanningItem(
  items: PlanningItem[],
  itemId?: string,
  itemTitle?: string,
  itemKind?: PlanningItemKind,
): { match: PlanningItem | null; ambiguous: boolean; candidates: PlanningItem[] } {
  const scoped = itemKind ? items.filter((item) => item.kind === itemKind) : items;

  if (itemId) {
    const byId = scoped.find((item) => item.id === itemId);
    if (byId) {
      return { match: byId, ambiguous: false, candidates: [byId] };
    }
  }

  if (!itemTitle) {
    return { match: null, ambiguous: false, candidates: [] };
  }

  const needle = itemTitle.trim().toLowerCase();
  const exactMatches = scoped.filter((item) => item.title.toLowerCase() === needle);
  if (exactMatches.length === 1) {
    return { match: exactMatches[0], ambiguous: false, candidates: exactMatches };
  }
  if (exactMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: exactMatches };
  }

  const containsMatches = scoped.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) || needle.includes(item.title.toLowerCase()),
  );
  if (containsMatches.length === 1) {
    return { match: containsMatches[0], ambiguous: false, candidates: containsMatches };
  }
  if (containsMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: containsMatches };
  }

  return { match: null, ambiguous: false, candidates: [] };
}

function matchAutomation(
  automations: Automation[],
  automationId?: string,
  automationTitle?: string,
): { match: Automation | null; ambiguous: boolean; candidates: Automation[] } {
  if (automationId) {
    const byId = automations.find((automation) => automation.id === automationId);
    if (byId) {
      return { match: byId, ambiguous: false, candidates: [byId] };
    }
  }

  if (!automationTitle?.trim()) {
    return { match: null, ambiguous: false, candidates: [] };
  }

  const needle = automationTitle.trim().toLowerCase();
  const exactMatches = automations.filter((automation) => automation.title.trim().toLowerCase() === needle);
  if (exactMatches.length === 1) {
    return { match: exactMatches[0], ambiguous: false, candidates: exactMatches };
  }
  if (exactMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: exactMatches };
  }

  const partialMatches = automations.filter((automation) => {
    const lowerTitle = automation.title.toLowerCase();
    return lowerTitle.includes(needle) || needle.includes(lowerTitle);
  });
  if (partialMatches.length === 1) {
    return { match: partialMatches[0], ambiguous: false, candidates: partialMatches };
  }
  if (partialMatches.length > 1) {
    return { match: null, ambiguous: true, candidates: partialMatches };
  }

  return { match: null, ambiguous: false, candidates: [] };
}

function matchClass(
  classes: SchoolClass[],
  classId?: string,
  className?: string,
): { match: SchoolClass | null; ambiguous: boolean; candidates: SchoolClass[] } {
  if (classId) {
    const byId = classes.find((schoolClass) => schoolClass.id === classId);
    if (byId) {
      return { match: byId, ambiguous: false, candidates: [byId] };
    }
  }

  const resolved = resolveClassMatch(classes, className);
  if (resolved.status === "matched") {
    const [candidate] = resolved.candidates;
    return { match: candidate ?? null, ambiguous: false, candidates: resolved.candidates };
  }
  if (resolved.status === "ambiguous") {
    return { match: null, ambiguous: true, candidates: resolved.candidates };
  }
  return { match: null, ambiguous: false, candidates: [] };
}

function resolveClassMatch(classes: SchoolClass[], className?: string | null) {
  if (!className?.trim()) {
    return {
      id: undefined,
      status: "none" as const,
      candidates: [] as SchoolClass[],
    };
  }

  const needle = className.trim().toLowerCase();
  const exactMatches = classes.filter((schoolClass) => schoolClass.name.trim().toLowerCase() === needle);
  if (exactMatches.length === 1) {
    return { id: exactMatches[0].id, status: "matched" as const, candidates: exactMatches };
  }
  if (exactMatches.length > 1) {
    return { id: undefined, status: "ambiguous" as const, candidates: exactMatches };
  }

  const partialMatches = classes.filter((schoolClass) => {
    const lowerName = schoolClass.name.toLowerCase();
    return lowerName.includes(needle) || needle.includes(lowerName);
  });

  if (partialMatches.length === 1) {
    return { id: partialMatches[0].id, status: "matched" as const, candidates: partialMatches };
  }
  if (partialMatches.length > 1) {
    return { id: undefined, status: "ambiguous" as const, candidates: partialMatches };
  }

  return { id: undefined, status: "not_found" as const, candidates: [] as SchoolClass[] };
}

function formatPlanningKindLabel(kind: PlanningItemKind) {
  return kind === "recurring_activity" ? "activity" : "event";
}

function formatPlanningCandidate(item: PlanningItem) {
  return `- **${item.title}** (${formatPlanningKindLabel(item.kind)})`;
}

function formatAutomationCandidate(automation: Automation) {
  const state = automation.enabled ? "enabled" : "paused";
  return `- **${automation.title}** (${automation.scheduleDescription}; ${state})`;
}

function formatClassCandidate(schoolClass: SchoolClass) {
  const schedule = formatClassScheduleSummary(schoolClass);
  return schedule ? `- **${schoolClass.name}** (${schedule})` : `- **${schoolClass.name}**`;
}

function formatNoteCandidate(note: StudentNote) {
  const label = note.title?.trim() ? note.title : note.content;
  return `- **${label}**`;
}

function formatNoteUpdateSummary(
  note: StudentNote,
  updates: {
    content?: string;
    title?: string | null;
  },
) {
  const changeParts: string[] = [];

  if (updates.title !== undefined) {
    changeParts.push(note.title ? `title set to **${note.title}**` : "title cleared");
  }

  if (updates.content !== undefined) {
    changeParts.push("content updated");
  }

  return changeParts;
}

function formatPlanningUpdateSummary(
  item: PlanningItem,
  originalTitle: string,
  updates: {
    kind?: PlanningItemKind;
    title?: string;
    daysOfWeek?: string[] | null;
    date?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
    notes?: string | null;
    isAllDay?: boolean;
    enabled?: boolean;
  },
) {
  const changeParts: string[] = [];

  if (updates.title !== undefined && item.title !== originalTitle) {
    changeParts.push(`renamed to **${item.title}**`);
  }
  if (updates.daysOfWeek !== undefined && item.kind === "recurring_activity" && item.daysOfWeek?.length) {
    changeParts.push(`days set to **${item.daysOfWeek.join(", ")}**`);
  }
  if (updates.date !== undefined) {
    if (item.kind === "one_off_event" && item.date) {
      changeParts.push(`date set to **${item.date}**`);
    } else if (updates.date === null) {
      changeParts.push("date cleared");
    }
  }
  if (updates.isAllDay !== undefined && item.isAllDay) {
    changeParts.push("set to **all day**");
  } else if ((updates.startTime !== undefined || updates.endTime !== undefined) && item.startTime && item.endTime) {
    changeParts.push(`time set to **${item.startTime}-${item.endTime}**`);
  } else if (updates.startTime !== undefined && item.startTime) {
    changeParts.push(`start time set to **${item.startTime}**`);
  } else if (
    (updates.startTime === null || updates.endTime === null) &&
    !item.startTime &&
    !item.endTime
  ) {
    changeParts.push("time cleared");
  }
  if (updates.location !== undefined) {
    if (item.location) {
      changeParts.push(`location set to **${item.location}**`);
    } else if (updates.location === null) {
      changeParts.push("location cleared");
    }
  }
  if (updates.notes !== undefined) {
    if (item.notes) {
      changeParts.push("notes updated");
    } else if (updates.notes === null) {
      changeParts.push("notes cleared");
    }
  }
  if (updates.enabled !== undefined) {
    changeParts.push(item.enabled ? "enabled" : "disabled");
  }

  return changeParts;
}

function formatAutomationUpdateSummary(
  automation: Automation,
  originalTitle: string,
  updates: {
    type?: Automation["type"];
    title?: string;
    scheduleDescription?: string;
    scheduleConfig?: Record<string, unknown>;
    deliveryChannel?: Automation["deliveryChannel"];
    enabled?: boolean;
    relatedClassName?: string | null;
    relatedTaskId?: string | null;
  },
) {
  const changeParts: string[] = [];

  if (updates.title !== undefined && automation.title !== originalTitle) {
    changeParts.push(`renamed to **${automation.title}**`);
  }
  if (updates.scheduleDescription !== undefined) {
    changeParts.push(`schedule set to **${automation.scheduleDescription}**`);
  }
  if (updates.deliveryChannel !== undefined) {
    changeParts.push(`delivery set to **${automation.deliveryChannel}**`);
  }
  if (updates.enabled !== undefined) {
    changeParts.push(automation.enabled ? "enabled" : "paused");
  }
  if (updates.type !== undefined) {
    changeParts.push(`type set to **${automation.type}**`);
  }
  if (updates.relatedTaskId !== undefined) {
    changeParts.push(automation.relatedTaskId ? "linked task updated" : "linked task cleared");
  }

  return changeParts;
}

function formatClassUpdateSummary(
  schoolClass: SchoolClass,
  originalName: string,
  updates: {
    name?: string;
    teacherName?: string | null;
    teacherEmail?: string | null;
    room?: string | null;
    color?: string | null;
    days?: string[] | null;
    startTime?: string | null;
    endTime?: string | null;
    rotationDays?: string[] | null;
    scheduleLabel?: string | null;
    notes?: string | null;
    syllabusText?: string | null;
    classNotes?: string | null;
    isApCourse?: boolean | null;
    apCourseKey?: string | null;
  },
) {
  const changeParts: string[] = [];

  if (updates.name !== undefined && schoolClass.name !== originalName) {
    changeParts.push(`renamed to **${schoolClass.name}**`);
  }
  if (updates.teacherName !== undefined) {
    changeParts.push(
      schoolClass.teacherName ? `teacher set to **${schoolClass.teacherName}**` : "teacher cleared",
    );
  }
  if (updates.teacherEmail !== undefined) {
    changeParts.push(schoolClass.teacherEmail ? "teacher email updated" : "teacher email cleared");
  }
  if (updates.room !== undefined) {
    changeParts.push(schoolClass.room ? `room set to **${schoolClass.room}**` : "room cleared");
  }
  if (updates.days !== undefined || updates.rotationDays !== undefined || updates.scheduleLabel !== undefined) {
    const schedule = formatClassScheduleSummary(schoolClass);
    changeParts.push(schedule ? `schedule set to **${schedule}**` : "schedule cleared");
  }
  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    if (schoolClass.startTime && schoolClass.endTime) {
      changeParts.push(`time set to **${schoolClass.startTime}-${schoolClass.endTime}**`);
    } else if (!schoolClass.startTime && !schoolClass.endTime) {
      changeParts.push("time cleared");
    }
  }
  if (updates.notes !== undefined) {
    changeParts.push(schoolClass.notes ? "notes updated" : "notes cleared");
  }
  if (updates.syllabusText !== undefined) {
    changeParts.push(schoolClass.syllabusText ? "syllabus updated" : "syllabus cleared");
  }
  if (updates.classNotes !== undefined) {
    changeParts.push(schoolClass.classNotes ? "class notes updated" : "class notes cleared");
  }

  return changeParts;
}

function formatTaskDueDate(value: string) {
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) {
    return value;
  }

  return dueDate.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDestinationReference(
  label: string,
  path: string,
  responseFormat: "web" | "plain",
) {
  return responseFormat === "web" ? `[${label}](${path})` : `${label.toLowerCase()} page`;
}

function formatUnresolvedClassSuffix(
  classMatch: ReturnType<typeof resolveClassMatch>,
  className?: string | null,
) {
  if (!className?.trim() || classMatch.status === "matched" || classMatch.status === "none") {
    return "";
  }

  if (classMatch.status === "ambiguous") {
    const options = classMatch.candidates.slice(0, 3).map((schoolClass) => schoolClass.name).join(", ");
    return ` I couldn't confidently match "${className}" to one class, so I left it uncategorized for now. The closest matches were ${options}.`;
  }

  return ` I couldn't confidently match "${className}" to one of your saved classes, so I left it uncategorized.`;
}

function formatNoteClassUpdateSuffix(
  classMatch: ReturnType<typeof resolveClassMatch>,
  className?: string | null,
) {
  if (!className?.trim() || classMatch.status === "matched" || classMatch.status === "none") {
    return "";
  }

  if (classMatch.status === "ambiguous") {
    const options = classMatch.candidates.slice(0, 3).map((schoolClass) => schoolClass.name).join(", ");
    return ` I kept the existing class because "${className}" could refer to ${options}.`;
  }

  return ` I kept the existing class because I couldn't confidently match "${className}" to one of your saved classes.`;
}

function formatAutomationClassUpdateSuffix(
  classMatch: ReturnType<typeof resolveClassMatch>,
  className?: string | null,
) {
  if (!className?.trim() || classMatch.status === "matched" || classMatch.status === "none") {
    return "";
  }

  if (classMatch.status === "ambiguous") {
    const options = classMatch.candidates.slice(0, 3).map((schoolClass) => schoolClass.name).join(", ");
    return ` I kept the existing linked class because "${className}" could refer to ${options}.`;
  }

  return ` I kept the existing linked class because I couldn't confidently match "${className}" to one of your saved classes.`;
}

function formatClassScheduleSummary(schoolClass: SchoolClass) {
  const rotation = schoolClass.rotationDays?.length ? schoolClass.rotationDays.join("/") : "";
  const days = schoolClass.days.length ? schoolClass.days.join("/") : "";
  const timing =
    schoolClass.startTime && schoolClass.endTime
      ? `${schoolClass.startTime}-${schoolClass.endTime}`
      : schoolClass.startTime || schoolClass.endTime;

  return [rotation || days, timing].filter(Boolean).join(" ");
}

function normalizeClassIdentity(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildClassScheduleIdentity(schoolClass: Pick<SchoolClass, "days" | "rotationDays" | "startTime" | "endTime">) {
  const days = [...schoolClass.days].sort().join(",");
  const rotationDays = [...(schoolClass.rotationDays ?? [])].sort().join(",");
  const startTime = schoolClass.startTime.trim();
  const endTime = schoolClass.endTime.trim();
  return `${days}|${rotationDays}|${startTime}|${endTime}`;
}

function findScheduleImportMatch(existingClasses: SchoolClass[], parsedClass: Omit<SchoolClass, "id">) {
  const normalizedName = normalizeClassIdentity(parsedClass.name);
  const sameName = existingClasses.filter(
    (schoolClass) => normalizeClassIdentity(schoolClass.name) === normalizedName,
  );
  const parsedScheduleIdentity = buildClassScheduleIdentity(parsedClass);

  const exactScheduleMatch = sameName.find(
    (schoolClass) => buildClassScheduleIdentity(schoolClass) === parsedScheduleIdentity,
  );
  if (exactScheduleMatch) {
    return { mode: "skip" as const, existing: exactScheduleMatch };
  }

  const confidentCandidateMatches = sameName.filter((schoolClass) =>
    classMatchesParsedImportSignature(schoolClass, parsedClass),
  );
  if (confidentCandidateMatches.length === 1) {
    return { mode: "update" as const, existing: confidentCandidateMatches[0] };
  }
  if (confidentCandidateMatches.length > 1) {
    return { mode: "ambiguous" as const, candidates: confidentCandidateMatches };
  }

  if (sameName.length === 1) {
    return { mode: "update" as const, existing: sameName[0] };
  }

  if (sameName.length > 1) {
    return { mode: "ambiguous" as const, candidates: sameName };
  }

  return null;
}

function replaceClassInList(classes: SchoolClass[], next: SchoolClass) {
  const index = classes.findIndex((schoolClass) => schoolClass.id === next.id);
  if (index === -1) {
    classes.push(next);
    return;
  }

  classes[index] = next;
}

function getParsedScheduleMissingFields(parsedClass: Omit<SchoolClass, "id">) {
  const missing: string[] = [];

  if (!parsedClass.startTime.trim() || !parsedClass.endTime.trim()) {
    missing.push("time");
  }

  const hasMeetingPattern =
    parsedClass.days.length > 0 || (parsedClass.rotationDays?.length ?? 0) > 0;
  if (!hasMeetingPattern) {
    missing.push("meeting pattern");
  }

  return missing;
}

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedText(value?: string | null) {
  return hasText(value) ? value.trim().toLowerCase() : "";
}

function sortedKey(values?: string[] | null) {
  return [...(values ?? [])].sort().join(",");
}

function classMatchesParsedImportSignature(
  existingClass: SchoolClass,
  parsedClass: Omit<SchoolClass, "id">,
) {
  let sawExplicitSignal = false;

  if (hasText(parsedClass.teacherName)) {
    sawExplicitSignal = true;
    if (normalizedText(existingClass.teacherName) !== normalizedText(parsedClass.teacherName)) {
      return false;
    }
  }

  if (hasText(parsedClass.teacherEmail)) {
    sawExplicitSignal = true;
    if (normalizedText(existingClass.teacherEmail) !== normalizedText(parsedClass.teacherEmail)) {
      return false;
    }
  }

  if (hasText(parsedClass.room)) {
    sawExplicitSignal = true;
    if (normalizedText(existingClass.room) !== normalizedText(parsedClass.room)) {
      return false;
    }
  }

  if (parsedClass.days.length > 0) {
    sawExplicitSignal = true;
    if (sortedKey(existingClass.days) !== sortedKey(parsedClass.days)) {
      return false;
    }
  }

  if ((parsedClass.rotationDays?.length ?? 0) > 0) {
    sawExplicitSignal = true;
    if (sortedKey(existingClass.rotationDays) !== sortedKey(parsedClass.rotationDays)) {
      return false;
    }
  }

  if (hasText(parsedClass.startTime) && hasText(parsedClass.endTime)) {
    sawExplicitSignal = true;
    if (
      existingClass.startTime.trim() !== parsedClass.startTime.trim() ||
      existingClass.endTime.trim() !== parsedClass.endTime.trim()
    ) {
      return false;
    }
  }

  return sawExplicitSignal;
}

function mergeImportedClass(
  existingClass: SchoolClass,
  parsedClass: Omit<SchoolClass, "id">,
): Omit<SchoolClass, "id"> {
  const nextDays = parsedClass.days.length > 0 ? parsedClass.days : existingClass.days;
  const nextRotationDays =
    (parsedClass.rotationDays?.length ?? 0) > 0
      ? parsedClass.rotationDays
      : existingClass.rotationDays;

  return {
    ...existingClass,
    name: parsedClass.name.trim() || existingClass.name,
    days: nextDays,
    rotationDays: nextRotationDays,
    scheduleLabel: parsedClass.scheduleLabel ?? existingClass.scheduleLabel,
    startTime:
      hasText(parsedClass.startTime) && hasText(parsedClass.endTime)
        ? parsedClass.startTime.trim()
        : existingClass.startTime,
    endTime:
      hasText(parsedClass.startTime) && hasText(parsedClass.endTime)
        ? parsedClass.endTime.trim()
        : existingClass.endTime,
    teacherName: hasText(parsedClass.teacherName) ? parsedClass.teacherName?.trim() : existingClass.teacherName,
    teacherEmail: hasText(parsedClass.teacherEmail) ? parsedClass.teacherEmail?.trim() : existingClass.teacherEmail,
    room: hasText(parsedClass.room) ? parsedClass.room?.trim() : existingClass.room,
    notes: hasText(parsedClass.notes) ? parsedClass.notes?.trim() : existingClass.notes,
    meetings:
      parsedClass.meetings && parsedClass.meetings.length > 0
        ? parsedClass.meetings
        : existingClass.meetings,
    color: existingClass.color ?? parsedClass.color,
  };
}
