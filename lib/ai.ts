import OpenAI from "openai";
import { detectAssistantIntent } from "./assistant-intent";
import {
  formatMaterialRetrievalForPrompt,
  retrieveRelevantMaterialExcerpts,
} from "./class-materials";
import type {
  ChatMessage,
  ReminderPreference,
  RotationDay,
  ScheduleArchitecture,
  SchoolCalendarEntry,
  SchoolClass,
  StudentTask,
} from "../types";
import { buildCalendarContext, getEffectiveDays } from "./schedule";
import { formatApTemplateForPrompt, getApTemplate } from "./ap-course-templates";
import { AI_CLASS_COLORS } from "./class-colors";
import { deriveScheduleLabel, formatRotationBadge, getClassRotationDays, normalizeRotationDays } from "./class-rotation";
import { normalizeScheduleArchitecture } from "./schedule-architecture";
import { sanitizeTaskDueAtFromInput } from "./task-due-at";

const client = new OpenAI(); // Reads OPENAI_API_KEY from environment automatically

// ── Name normalization ───────────────────────────────────────────────────────

/** Capitalize just the first letter, lowercase the rest. */
function capitalizeWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Normalize a teacher name to proper title case.
 * - "mr johnson"   → "Mr. Johnson"
 * - "mrs rubin"    → "Mrs. Rubin"
 * - "ms. smith"    → "Ms. Smith"
 * - "Dr jones"     → "Dr. Jones"
 * - Already correct input is returned cleaned up.
 */
export function normalizeTeacherName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;

  const TITLE_MAP: Record<string, string> = {
    mr: "Mr.",
    mrs: "Mrs.",
    ms: "Ms.",
    miss: "Ms.",
    dr: "Dr.",
    prof: "Prof.",
    professor: "Prof.",
  };

  const lower = trimmed.toLowerCase();

  for (const [prefix, title] of Object.entries(TITLE_MAP)) {
    // Match "mr johnson", "mr. johnson", "mr.johnson"
    const regex = new RegExp(`^${prefix}\\.?\\s*(.+)$`, "i");
    const m = lower.match(regex);
    if (m) {
      const rest = trimmed
        .slice(prefix.length)
        .replace(/^\.?\s*/, "")
        .split(/\s+/)
        .map(capitalizeWord)
        .join(" ");
      return `${title} ${rest}`.trim();
    }
  }

  // No recognized title prefix — just apply title case
  return trimmed.split(/\s+/).map(capitalizeWord).join(" ");
}

/**
 * Clean up an AI-generated task title.
 * Strips leading filler, applies title case (capitalize each word).
 * Short task titles (2–6 words) read better with every word capitalized.
 */
export function normalizeTaskTitle(raw: string): string {
  let title = raw.trim();
  if (!title) return title;

  // Strip common leading filler words the AI might emit
  title = title.replace(/^(a |an |the |my |i need to |i have to |do )/i, "");

  // Title-case every word — appropriate for short task names like "Bio Test", "Essay Draft"
  return title
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function parseNaturalLanguageTask(
  input: string,
  classes: SchoolClass[]
): Promise<Partial<StudentTask>> {
  const todayDate = new Date();
  const todayIso = todayDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const todayWeekday = todayDate.toLocaleDateString("en-US", { weekday: "long" }); // e.g. "Friday"

  const systemPrompt = `You are an AI assistant for a student planner app. The student will describe a school task in natural language. Extract the following as a JSON object with no markdown, no explanation, and no extra text:
* title: short clean task name (not the full sentence). For tests and quizzes, use "[Subject] Test" or "[Subject] Quiz" format (e.g. "Bio Test", "Calc Quiz"). Keep titles 2–5 words.
* type: one of assignment, test, quiz, reading, project, study, or null
* className: the class name if mentioned, or null
* dueAt: ISO 8601 date-time string if a due date is mentioned, or null. See date rules below.
* reminderAt: ISO 8601 date string if a reminder is mentioned, or null
* notes: any additional detail worth saving, or null

## Date rules (critical — follow exactly):
Today is ${todayWeekday}, ${todayIso}.

Relative date resolution:
- "next [weekday]" = the [weekday] of the FOLLOWING week. Even if today IS that weekday, "next Friday" still means the Friday 7 days from now.
- "this [weekday]" or "[weekday]" alone = the upcoming [weekday] within the current or next 7 days (could be today if same day is meant, otherwise the first upcoming occurrence).
- "tomorrow" = ${todayIso} + 1 day.
- Always compute the exact YYYY-MM-DD from today's weekday (${todayWeekday}) and the date (${todayIso}).

Time defaults:
- For tests, quizzes, and exams: if no specific time is given, use T23:59:00 as the time component (end of day). Never invent a morning/afternoon/evening time for assessments.
- For assignments and readings: if no time is given, use T23:59:00 (end of day).
- If a specific time is mentioned, use that time in HH:MM:SS format.

Return only valid JSON.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
    });

    const rawText = response.choices[0].message.content?.trim() ?? "";

    // Strip markdown code fences in case the model wraps the JSON in ```json ... ```
    const jsonText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonText);

    // Resolve className to classId via case-insensitive partial match
    let classId: string | undefined;
    if (parsed.className) {
      const needle = (parsed.className as string).toLowerCase();
      const match = classes.find(
        (c) =>
          c.name.toLowerCase().includes(needle) || needle.includes(c.name.toLowerCase())
      );
      classId = match?.id;
    }

    return {
      title: normalizeTaskTitle(parsed.title || input),
      classId,
      dueAt: sanitizeTaskDueAtFromInput(input, parsed.dueAt),
      type: parsed.type ?? undefined,
      reminderAt: parsed.reminderAt ?? undefined,
      description: parsed.notes ?? undefined,
      status: "todo",
      source: "ai-parsed",
    };
  } catch {
    // TODO: Log parse errors once error tracking (e.g. Sentry) is set up.
    return {
      title: input,
      status: "todo",
      source: "ai-parsed",
    };
  }
}

/**
 * Parses a full natural-language schedule description into an array of
 * SchoolClass-like objects ready to be bulk-added to the class store.
 *
 * Handles inputs like:
 *   "I have English A-day 8–9:15, Biology B-day 10:15–12..."
 *   "My A-day classes are English, History, Spanish. B-day: Bio, Calc, CS."
 *   "Mondays: Chemistry at 9. Tue/Thu: Biology lab 10:15–12."
 */
export async function parseNaturalLanguageSchedule(
  input: string,
  architecture?: ScheduleArchitecture,
): Promise<Array<Omit<SchoolClass, "id">>> {
  const normalizedArchitecture = normalizeScheduleArchitecture(architecture);
  const architectureInstructions =
    normalizedArchitecture.type === "rotation"
      ? `The selected schedule architecture is a rotation schedule using these labels: ${normalizedArchitecture.rotationLabels.join(", ")}.

Use only those labels in rotationDays.
- rotationDays: array of these labels — [] means fixed weekday schedule.
- If the student clearly uses this rotation and says a class is "every day", "daily", or "every school day", that means the class belongs to ALL rotation labels, so use all configured rotation labels and days: [] unless specific weekdays were also stated.
- Do not convert "every day" in a rotation context into monday-friday unless the student explicitly gives weekday-based meetings.`
      : `The selected schedule architecture is weekday-based.

- rotationDays must always be [].
- Use days to capture weekday meetings.
- If the student says "every day", "daily", or "every school day", use ["monday","tuesday","wednesday","thursday","friday"] unless they explicitly mention weekends.`;

  const systemPrompt = `You are an AI assistant for a student planner app. The student is describing their full class schedule in natural language. Extract every class and return ONLY valid JSON — no markdown, no explanation, no extra text.

Each class object must have:
- name: string — the class name
- rotationDays: array of strings
- days: array of weekday strings — the specific weekdays this class meets, e.g. ["monday","wednesday","friday"]. Use [] if the class follows pure A/B rotation with no specific weekday pattern mentioned.
- startTime: "HH:MM" 24-hour format (e.g. "08:00", "13:30"), or "" if the student did not give a reliable start time. Do NOT guess or invent a time.
- endTime: "HH:MM" 24-hour format, or "" if the student did not give a reliable end time. Do NOT guess or invent a time.
- teacherName: string or null
- teacherEmail: string or null (only if clearly stated as an email address)
- room: string or null

Valid weekday values: "monday" "tuesday" "wednesday" "thursday" "friday" "saturday" "sunday"

Architecture rules:
${architectureInstructions}

Reliability rules:
- Only create a class when the student clearly described a real class/course.
- Preserve uncertainty honestly. If a class name is clear but the meeting pattern or time is missing, leave those fields blank/empty instead of guessing.
- Do not infer default times from typical school schedules.
- Do not convert vague phrases like "later", "after lunch", or "in the morning" into a precise time.

Return format — an object with a single "classes" key:
{ "classes": [ { "name": "...", "rotationDays": [], "days": [...], "startTime": "HH:MM or empty string", "endTime": "HH:MM or empty string", "teacherName": null, "teacherEmail": null, "room": null } ] }`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
    });

    const rawText = response.choices[0].message.content?.trim() ?? "";
    const jsonText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonText) as { classes: Array<Record<string, unknown>> };

    return (parsed.classes ?? []).map((c, i) => {
      const rotationDays = normalizeRotationDays(
        Array.isArray(c.rotationDays)
          ? ((c.rotationDays as string[]).filter(Boolean) as string[])
          : [],
      );

      return {
        name: typeof c.name === "string" ? c.name : "Unnamed Class",
        rotationDays: rotationDays.length > 0 ? rotationDays : undefined,
        scheduleLabel: deriveScheduleLabel(rotationDays),
        days: Array.isArray(c.days)
          ? ((c.days as string[]).filter(Boolean) as SchoolClass["days"])
          : [],
        startTime: typeof c.startTime === "string" ? c.startTime.trim() : "",
        endTime: typeof c.endTime === "string" ? c.endTime.trim() : "",
        teacherName: typeof c.teacherName === "string" ? normalizeTeacherName(c.teacherName) : undefined,
        teacherEmail:
          typeof c.teacherEmail === "string" ? c.teacherEmail : undefined,
        room: typeof c.room === "string" ? c.room : undefined,
        color: AI_CLASS_COLORS[i % AI_CLASS_COLORS.length],
      };
    });
  } catch {
    return [];
  }
}

/**
 * Finds the first class explicitly mentioned in the user's message.
 * Used to decide whether to inject class-specific knowledge into the prompt.
 */
function findMentionedClass(message: string, classes: SchoolClass[]): SchoolClass | null {
  const lower = message.toLowerCase();
  // Prefer longer names first to avoid partial matches (e.g. "Bio" before "AP Bio")
  const sorted = [...classes].sort((a, b) => b.name.length - a.name.length);
  return sorted.find((c) => lower.includes(c.name.toLowerCase())) ?? null;
}

/**
 * Builds a compact class knowledge block for the system prompt.
 * Only called when a specific class is mentioned in the user message.
 * Returns an empty string when there's no knowledge to inject.
 */
function buildClassKnowledgeSection(cls: SchoolClass): string {
  const parts: string[] = [];

  if (cls.syllabusText?.trim()) {
    parts.push(`Syllabus/course overview:\n${cls.syllabusText.trim()}`);
  }
  if (cls.classNotes?.trim()) {
    parts.push(`Student notes about this class:\n${cls.classNotes.trim()}`);
  }
  if (cls.isApCourse) {
    const template = getApTemplate(cls.apCourseKey);
    if (template) {
      parts.push(formatApTemplateForPrompt(template));
    } else {
      parts.push("Course type: AP course (no built-in template available)");
    }
  }

  if (parts.length === 0) return "";
  return `\nClass knowledge for ${cls.name}:\n${parts.join("\n\n")}`;
}

// Called by /api/ai/assistant when the message intent is classified as "chat".
// Builds a context-aware system prompt and calls the OpenAI API directly.
export async function answerWorkloadQuestion(
  message: string,
  tasks: StudentTask[],
  classes: SchoolClass[],
  reminderPreferences: ReminderPreference,
  effectiveDayType?: RotationDay | null,
  calendarEntries?: SchoolCalendarEntry[],
  scheduleArchitecture?: ScheduleArchitecture,
): Promise<ChatMessage> {
  const today = new Date();
  const assistantIntent = detectAssistantIntent(message, classes);
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const readableDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const readableTime = today.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const calendarSection = buildCalendarContext(
    calendarEntries ?? [],
    todayDateStr,
    effectiveDayType ?? null,
    scheduleArchitecture,
  );

  // Only inject class-specific knowledge when the message references a particular class
  const mentionedClass = findMentionedClass(message, classes);
  const classKnowledgeSection = mentionedClass
    ? buildClassKnowledgeSection(mentionedClass)
    : "";
  const materialRetrieval = retrieveRelevantMaterialExcerpts({ message, classes });

  // Build class schedule lines with per-day meeting detail and A/B labels
  const classLines = classes
    .map((c) => {
      const effectiveDays = getEffectiveDays(c);
      const rotationBadge = formatRotationBadge(c.rotationDays, c.scheduleLabel);
      const labelNote = rotationBadge ? ` [${rotationBadge} rotation]` : "";
      const teacherNote = c.teacherName ? ` — teacher: ${c.teacherName}` : "";
      const emailNote = c.teacherEmail ? ` <${c.teacherEmail}>` : "";
      const roomNote = c.room ? `, room: ${c.room}` : "";
      if (c.meetings && c.meetings.length > 0) {
        const meetingLines = c.meetings
          .map((m) => `    ${m.day}: ${m.startTime}–${m.endTime}`)
          .join("\n");
        return `* ${c.name}${labelNote}${teacherNote}${emailNote}${roomNote}, per-day schedule:\n${meetingLines}`;
      }
      const timeStr =
        c.startTime && c.endTime ? `, ${c.startTime}–${c.endTime}` : "";
      const rotationDays = getClassRotationDays(c);
      const daysStr =
        effectiveDays.length > 0
          ? ` meets ${effectiveDays.join(", ")}`
          : rotationDays.length > 0
            ? " (rotation-based, no fixed weekdays)"
            : " (no meeting days saved)";
      return `* ${c.name}${labelNote}${daysStr}${timeStr}${teacherNote}${emailNote}${roomNote}`;
    })
    .join("\n");

  const taskLines = tasks
    .map((t) => {
      const classMatch = classes.find((c) => c.id === t.classId);
      const parts = [`* ${t.title}`];
      if (t.type) parts.push(t.type);
      if (classMatch) parts.push(classMatch.name);
      if (t.dueAt) {
        const dueDate = new Date(t.dueAt);
        parts.push(
          `due ${dueDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}`
        );
      }
      parts.push(`status ${t.status}`);
      return parts.join(", ");
    })
    .join("\n");

  const materialInventoryLines = classes
    .filter((schoolClass) => (schoolClass.materials?.length ?? 0) > 0)
    .map(
      (schoolClass) =>
        `* ${schoolClass.name}: ${schoolClass.materials?.length ?? 0} saved material(s)`,
    )
    .join("\n");

  const dailySummaryLine = reminderPreferences.dailySummaryEnabled
    ? `* Daily summary: enabled at ${reminderPreferences.dailySummaryTime ?? "a saved time"}`
    : "* Daily summary: disabled";
  const tonightSummaryLine = reminderPreferences.tonightSummaryEnabled
    ? `* Tonight summary: enabled at ${reminderPreferences.tonightSummaryTime ?? "a saved time"}`
    : "* Tonight summary: disabled";
  const dueSoonLine = reminderPreferences.dueSoonRemindersEnabled
    ? `* Due soon reminders: enabled, ${reminderPreferences.dueSoonHoursBefore ?? 0} hours before`
    : "* Due soon reminders: disabled";

  const systemPrompt = `You are a calm, smart academic assistant built into a student planner app. Today is ${readableDate} at ${readableTime}.

School calendar context:
${calendarSection}

Detected intent:
${assistantIntent}

The student's classes are:
${classLines || "No classes on record."}${classKnowledgeSection}

The student's current tasks are:
${taskLines || "No tasks on record."}

Saved class material inventory:
${materialInventoryLines || "No class materials on record."}

Relevant class material retrieval for this message:
${formatMaterialRetrievalForPrompt(materialRetrieval)}

The student's reminder preferences are:
${dailySummaryLine}
${tonightSummaryLine}
${dueSoonLine}

## How to respond:

Start with a short direct answer — one or two sentences, no preamble. Then add 2–4 concise bullet points only if the question warrants detail. For simple questions (yes/no, single-fact), skip bullets entirely. For planning or overview questions, group by day using ### headings (e.g. ### Monday). At the end of relevant answers, offer one short follow-up action like "I can break that into smaller steps" or "Want me to help plan tonight?" — but only when it's genuinely useful, not on every reply.

Keep answers concise. Bold class names, due dates, and key deadlines. Use section headings only for multi-day or multi-part answers. Place 1–2 emojis naturally where they add clarity (dates, completed items) — not on every line. Sound direct and student-friendly, not robotic or motivational.

Never invent information not found above. For teacher questions, answer from the class list — if no teacher is recorded, say so in one sentence. For email drafting, use teacher info from context and note you can draft but not send. Only say you used notes/materials when retrieved excerpts are actually present. If no relevant excerpts were found, say so plainly.`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 600,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });

  const content =
    response.choices[0].message.content ?? "Sorry, I couldn't respond right now.";

  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
  };
}
