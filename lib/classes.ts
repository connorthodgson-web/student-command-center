import type { ClassMeetingTime, SchoolClass, Weekday } from "../types";
import { deriveScheduleLabel, normalizeRotationDays } from "./class-rotation";
import { normalizeClassColor } from "./class-colors";

export type DbClassRow = {
  id: string;
  user_id: string;
  name: string;
  teacher_name: string | null;
  teacher_email: string | null;
  room: string | null;
  color: string | null;
  days: Weekday[] | null;
  start_time: string | null;
  end_time: string | null;
  meetings: ClassMeetingTime[] | null;
  schedule_label: string | null;
  rotation_days: string[] | null;
  notes: string | null;
  syllabus_text: string | null;
  class_notes: string | null;
  is_ap_course: boolean | null;
  ap_course_key: string | null;
  created_at: string;
};

export type ClassInsert = Omit<SchoolClass, "id">;
export type ClassUpdate = Partial<Omit<SchoolClass, "id">>;

export function mapDbClassToSchoolClass(row: DbClassRow): SchoolClass {
  const rotationDays = normalizeRotationDays(row.rotation_days, row.schedule_label);

  return {
    id: row.id,
    name: row.name,
    teacherName: row.teacher_name ?? undefined,
    teacherEmail: row.teacher_email ?? undefined,
    room: row.room ?? undefined,
    color: normalizeClassColor(row.color) ?? undefined,
    days: row.days ?? [],
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    meetings: row.meetings ?? undefined,
    rotationDays: rotationDays.length > 0 ? rotationDays : undefined,
    scheduleLabel: deriveScheduleLabel(rotationDays),
    notes: row.notes ?? undefined,
    syllabusText: row.syllabus_text ?? undefined,
    classNotes: row.class_notes ?? undefined,
    isApCourse: row.is_ap_course ?? undefined,
    apCourseKey: row.ap_course_key ?? undefined,
  };
}

export function mapSchoolClassToInsert(
  schoolClass: ClassInsert,
  userId: string,
): Partial<Omit<DbClassRow, "id" | "created_at">> {
  const normalized = normalizeSchoolClassInput(schoolClass, { requireName: true });
  const rotationDays = normalizeRotationDays(
    normalized.rotationDays,
    normalized.scheduleLabel,
  );
  const syllabusText = emptyToNull(normalized.syllabusText);
  const classNotes = emptyToNull(normalized.classNotes);

  return {
    user_id: userId,
    name: normalized.name.trim(),
    teacher_name: emptyToNull(normalized.teacherName),
    teacher_email: emptyToNull(normalized.teacherEmail),
    room: emptyToNull(normalized.room),
    color: emptyToNull(normalizeClassColor(normalized.color)),
    days: normalized.days.length > 0 ? normalized.days : null,
    start_time: emptyToNull(normalized.startTime),
    end_time: emptyToNull(normalized.endTime),
    meetings:
      normalized.meetings && normalized.meetings.length > 0
        ? normalized.meetings
        : null,
    schedule_label: deriveScheduleLabel(rotationDays) ?? null,
    ...(rotationDays.length > 0 ? { rotation_days: rotationDays } : {}),
    notes: emptyToNull(normalized.notes),
    ...(syllabusText !== null ? { syllabus_text: syllabusText } : {}),
    ...(classNotes !== null ? { class_notes: classNotes } : {}),
    ...(normalized.isApCourse !== undefined
      ? { is_ap_course: normalized.isApCourse }
      : {}),
    ...(normalized.apCourseKey !== undefined
      ? { ap_course_key: normalized.apCourseKey ?? null }
      : {}),
  };
}

export function mapSchoolClassToUpdate(updates: ClassUpdate) {
  const normalized = normalizeSchoolClassInput(updates);
  const payload: Partial<Omit<DbClassRow, "id" | "user_id" | "created_at">> = {};
  const rotationDays =
    "rotationDays" in normalized || "scheduleLabel" in normalized
      ? normalizeRotationDays(normalized.rotationDays, normalized.scheduleLabel)
      : null;

  if ("name" in normalized && normalized.name !== undefined) {
    payload.name = normalized.name.trim();
  }
  if ("teacherName" in normalized) {
    payload.teacher_name = emptyToNull(normalized.teacherName);
  }
  if ("room" in normalized) {
    payload.room = emptyToNull(normalized.room);
  }
  if ("color" in normalized) {
    payload.color = emptyToNull(normalizeClassColor(normalized.color));
  }
  if ("days" in normalized) {
    payload.days = normalized.days && normalized.days.length > 0 ? normalized.days : null;
  }
  if ("startTime" in normalized) {
    payload.start_time = emptyToNull(normalized.startTime);
  }
  if ("endTime" in normalized) {
    payload.end_time = emptyToNull(normalized.endTime);
  }
  if ("meetings" in normalized) {
    payload.meetings =
      normalized.meetings && normalized.meetings.length > 0 ? normalized.meetings : null;
  }
  if (rotationDays !== null) {
    payload.schedule_label = deriveScheduleLabel(rotationDays) ?? null;
    payload.rotation_days = rotationDays.length > 0 ? rotationDays : null;
  }
  if ("teacherEmail" in normalized) {
    payload.teacher_email = emptyToNull(normalized.teacherEmail);
  }
  if ("notes" in normalized) {
    payload.notes = emptyToNull(normalized.notes);
  }
  if ("syllabusText" in normalized) {
    payload.syllabus_text = emptyToNull(normalized.syllabusText);
  }
  if ("classNotes" in normalized) {
    payload.class_notes = emptyToNull(normalized.classNotes);
  }
  if ("isApCourse" in normalized) {
    payload.is_ap_course = normalized.isApCourse ?? null;
  }
  if ("apCourseKey" in normalized) {
    payload.ap_course_key = normalized.apCourseKey ?? null;
  }

  return payload;
}

export function normalizeSchoolClassInput<T extends Partial<ClassInsert>>(
  input: T,
  options: { requireName?: boolean } = {},
): T {
  const next = { ...input } as T;

  if ("name" in next) {
    const trimmed = typeof next.name === "string" ? next.name.trim() : "";
    if (options.requireName && !trimmed) {
      throw new Error("Class name is required.");
    }
    if (!trimmed) {
      throw new Error("Class name cannot be empty.");
    }
    next.name = trimmed as T["name"];
  }

  if ("days" in next && next.days) {
    next.days = normalizeWeekdays(next.days) as T["days"];
  }

  if ("startTime" in next) {
    next.startTime = normalizeOptionalTime(next.startTime, "startTime") as T["startTime"];
  }

  if ("endTime" in next) {
    next.endTime = normalizeOptionalTime(next.endTime, "endTime") as T["endTime"];
  }

  if ("meetings" in next && next.meetings) {
    next.meetings = normalizeMeetings(next.meetings) as T["meetings"];
  }

  if ("teacherEmail" in next && next.teacherEmail) {
    const trimmed = next.teacherEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error("Teacher email must be a valid email address.");
    }
    next.teacherEmail = trimmed as T["teacherEmail"];
  }

  if ("rotationDays" in next && next.rotationDays) {
    next.rotationDays = normalizeRotationDays(next.rotationDays, next.scheduleLabel) as T["rotationDays"];
  }

  if ("color" in next) {
    next.color = normalizeClassColor(next.color) as T["color"];
  }

  return next;
}

function normalizeMeetings(meetings: ClassMeetingTime[]) {
  return meetings.map((meeting) => ({
    ...meeting,
    day: normalizeWeekdays([meeting.day])[0],
    startTime: normalizeRequiredTime(meeting.startTime, "meeting.startTime"),
    endTime: normalizeRequiredTime(meeting.endTime, "meeting.endTime"),
  }));
}

function normalizeWeekdays(days: Weekday[]) {
  const allowed: Weekday[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const uniqueDays = Array.from(new Set(days));
  for (const day of uniqueDays) {
    if (!allowed.includes(day)) {
      throw new Error(`Invalid weekday: ${day}.`);
    }
  }

  return uniqueDays;
}

function normalizeOptionalTime(value: string | undefined, fieldName: string) {
  if (value === undefined) return value;
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return normalizeRequiredTime(trimmed, fieldName);
}

function normalizeRequiredTime(value: string, fieldName: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use HH:MM format.`);
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`${fieldName} must be a valid time.`);
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function emptyToNull(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
