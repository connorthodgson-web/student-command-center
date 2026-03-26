import type { ClassMeetingTime, SchoolClass, Weekday } from "../types";

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
  schedule_label: "A" | "B" | null;
  notes: string | null;
  syllabus_text: string | null;
  class_notes: string | null;
  // NOTE: is_ap_course and ap_course_key are not yet in the DB schema.
  // Add columns via migration before re-enabling these fields.
  created_at: string;
};

export type ClassInsert = Omit<SchoolClass, "id">;
export type ClassUpdate = Partial<Omit<SchoolClass, "id">>;

export function mapDbClassToSchoolClass(row: DbClassRow): SchoolClass {
  return {
    id: row.id,
    name: row.name,
    teacherName: row.teacher_name ?? undefined,
    // Read teacher_email and notes if the columns exist in DB (optional fields — safe with ??)
    teacherEmail: row.teacher_email ?? undefined,
    room: row.room ?? undefined,
    color: row.color ?? undefined,
    days: row.days ?? [],
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    meetings: row.meetings ?? undefined,
    scheduleLabel: row.schedule_label ?? undefined,
    notes: row.notes ?? undefined,
    syllabusText: row.syllabus_text ?? undefined,
    classNotes: row.class_notes ?? undefined,
    // is_ap_course / ap_course_key not yet in DB — omitted until migration runs
  };
}

export function mapSchoolClassToInsert(
  schoolClass: ClassInsert,
  userId: string
): Omit<DbClassRow, "id" | "created_at"> {
  return {
    user_id: userId,
    name: schoolClass.name.trim(),
    teacher_name: emptyToNull(schoolClass.teacherName),
    teacher_email: emptyToNull(schoolClass.teacherEmail),
    room: emptyToNull(schoolClass.room),
    color: emptyToNull(schoolClass.color),
    days: schoolClass.days.length > 0 ? schoolClass.days : null,
    start_time: emptyToNull(schoolClass.startTime),
    end_time: emptyToNull(schoolClass.endTime),
    meetings:
      schoolClass.meetings && schoolClass.meetings.length > 0
        ? schoolClass.meetings
        : null,
    schedule_label: schoolClass.scheduleLabel ?? null,
    notes: emptyToNull(schoolClass.notes),
    syllabus_text: emptyToNull(schoolClass.syllabusText),
    class_notes: emptyToNull(schoolClass.classNotes),
    // is_ap_course / ap_course_key intentionally excluded — columns not yet in DB
  };
}

export function mapSchoolClassToUpdate(updates: ClassUpdate) {
  const payload: Partial<Omit<DbClassRow, "id" | "user_id" | "created_at">> = {};

  if ("name" in updates && updates.name !== undefined) {
    payload.name = updates.name.trim();
  }
  if ("teacherName" in updates) {
    payload.teacher_name = emptyToNull(updates.teacherName);
  }
  if ("room" in updates) {
    payload.room = emptyToNull(updates.room);
  }
  if ("color" in updates) {
    payload.color = emptyToNull(updates.color);
  }
  if ("days" in updates) {
    payload.days = updates.days && updates.days.length > 0 ? updates.days : null;
  }
  if ("startTime" in updates) {
    payload.start_time = emptyToNull(updates.startTime);
  }
  if ("endTime" in updates) {
    payload.end_time = emptyToNull(updates.endTime);
  }
  if ("meetings" in updates) {
    payload.meetings =
      updates.meetings && updates.meetings.length > 0 ? updates.meetings : null;
  }
  if ("scheduleLabel" in updates) {
    payload.schedule_label = updates.scheduleLabel ?? null;
  }
  if ("teacherEmail" in updates) {
    payload.teacher_email = emptyToNull(updates.teacherEmail);
  }
  if ("notes" in updates) {
    payload.notes = emptyToNull(updates.notes);
  }
  if ("syllabusText" in updates) {
    payload.syllabus_text = emptyToNull(updates.syllabusText);
  }
  if ("classNotes" in updates) {
    payload.class_notes = emptyToNull(updates.classNotes);
  }
  // isApCourse / apCourseKey intentionally excluded — columns not yet in DB

  return payload;
}

function emptyToNull(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
