import OpenAI from "openai";
import type { ChatMessage, ReminderPreference, SchoolCalendarEntry, SchoolClass, StudentTask } from "../types";
import { buildCalendarContext, getEffectiveDays } from "./schedule";

const client = new OpenAI(); // Reads OPENAI_API_KEY from environment automatically

export async function parseNaturalLanguageTask(
  input: string,
  classes: SchoolClass[]
): Promise<Partial<StudentTask>> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const systemPrompt = `You are an AI assistant for a student planner app. The student will describe a school task in natural language. Extract the following as a JSON object with no markdown, no explanation, and no extra text:
* title: short clean task name (not the full sentence)
* type: one of assignment, test, quiz, reading, project, study, or null
* className: the class name if mentioned, or null
* dueAt: ISO 8601 date string if a due date is mentioned, or null. Today is ${today}.
* reminderAt: ISO 8601 date string if a reminder is mentioned, or null
* notes: any additional detail worth saving, or null
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
      title: parsed.title || input,
      classId,
      dueAt: parsed.dueAt ?? undefined,
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

// Colors auto-assigned to AI-parsed classes in rotation order
const CLASS_COLORS = ["#d4edd9", "#d4e6f7", "#fdefd3", "#fde0e0", "#ebe0fd", "#dde3e8"];

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
  input: string
): Promise<Array<Omit<SchoolClass, "id">>> {
  const systemPrompt = `You are an AI assistant for a student planner app. The student is describing their full class schedule in natural language. Extract every class and return ONLY valid JSON — no markdown, no explanation, no extra text.

Each class object must have:
- name: string — the class name
- scheduleLabel: "A" | "B" | null — if the class is on A-day or B-day rotation; null means it meets on a fixed weekly schedule
- days: array of weekday strings — the specific weekdays this class meets, e.g. ["monday","wednesday","friday"]. Use [] if the class follows pure A/B rotation with no specific weekday pattern mentioned.
- startTime: "HH:MM" 24-hour format (e.g. "08:00", "13:30"). Use "08:00" if not specified.
- endTime: "HH:MM" 24-hour format. Use "09:00" if not specified.
- teacherName: string or null
- teacherEmail: string or null (only if clearly stated as an email address)
- room: string or null

Valid weekday values: "monday" "tuesday" "wednesday" "thursday" "friday" "saturday" "sunday"

Return format — an object with a single "classes" key:
{ "classes": [ { "name": "...", "scheduleLabel": null, "days": [...], "startTime": "HH:MM", "endTime": "HH:MM", "teacherName": null, "teacherEmail": null, "room": null } ] }`;

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

    return (parsed.classes ?? []).map((c, i) => ({
      name: typeof c.name === "string" ? c.name : "Unnamed Class",
      scheduleLabel:
        c.scheduleLabel === "A" ? "A" : c.scheduleLabel === "B" ? "B" : undefined,
      days: Array.isArray(c.days) ? (c.days as string[]).filter(Boolean) as SchoolClass["days"] : [],
      startTime: typeof c.startTime === "string" ? c.startTime : "08:00",
      endTime: typeof c.endTime === "string" ? c.endTime : "09:00",
      teacherName: typeof c.teacherName === "string" ? c.teacherName : undefined,
      teacherEmail: typeof c.teacherEmail === "string" ? c.teacherEmail : undefined,
      room: typeof c.room === "string" ? c.room : undefined,
      color: CLASS_COLORS[i % CLASS_COLORS.length],
    }));
  } catch {
    return [];
  }
}

// Called by /api/ai/assistant when the message intent is classified as "chat".
// Builds a context-aware system prompt and calls the OpenAI API directly.
export async function answerWorkloadQuestion(
  message: string,
  tasks: StudentTask[],
  classes: SchoolClass[],
  reminderPreferences: ReminderPreference,
  effectiveDayType?: "A" | "B" | null,
  calendarEntries?: SchoolCalendarEntry[]
): Promise<ChatMessage> {
  const today = new Date();
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
    effectiveDayType ?? null
  );

  // Build class schedule lines with per-day meeting detail and A/B labels
  const classLines = classes
    .map((c) => {
      const effectiveDays = getEffectiveDays(c);
      const labelNote = c.scheduleLabel ? ` [${c.scheduleLabel}-Day rotation]` : "";
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
      const daysStr = effectiveDays.length > 0 ? ` meets ${effectiveDays.join(", ")}` : " (pure A/B rotation, no fixed days)";
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

The student's classes are:
${classLines || "No classes on record."}

The student's current tasks are:
${taskLines || "No tasks on record."}

The student's reminder preferences are:
${dailySummaryLine}
${tonightSummaryLine}
${dueSoonLine}

## How to respond:

Start with a short direct answer — one or two sentences, no preamble. Then add 2–4 concise bullet points only if the question warrants detail. For simple questions (yes/no, single-fact), skip bullets entirely. For planning or overview questions, group by day using ### headings (e.g. ### Monday). At the end of relevant answers, offer one short follow-up action like "I can break that into smaller steps" or "Want me to help plan tonight?" — but only when it's genuinely useful, not on every reply.

Keep answers concise. Bold class names, due dates, and key deadlines. Use section headings only for multi-day or multi-part answers. Place 1–2 emojis naturally where they add clarity (dates, completed items) — not on every line. Sound direct and student-friendly, not robotic or motivational.

Never invent information not found above. For teacher questions, answer from the class list — if no teacher is recorded, say so in one sentence. For email drafting, use teacher info from context and note you can draft but not send.

Examples:
- "Do I have school Friday?" → one sentence, no bullets
- "What do I have this week?" → brief intro, then ### Monday / ### Tuesday with bullets under each
- "What should I work on tonight?" → direct answer with bullets if multiple items, optional follow-up offer
- "Who teaches AP Bio?" → one sentence from class list`;

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
