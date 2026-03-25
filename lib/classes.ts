import type { ClassMeetingTime, SchoolClass, Weekday } from "../types";

export type DbClassRow = {
  id: string;
  user_id: string;
  name: string;
  teacher_name: string | null;
  room: string | null;
  color: string | null;
  days: Weekday[] | null;
  start_time: string | null;
  end_time: string | null;
  meetings: ClassMeetingTime[] | null;
  schedule_label: "A" | "B" | null;
  created_at: string;
};

export type ClassInsert = Omit<SchoolClass, "id">;
export type ClassUpdate = Partial<Omit<SchoolClass, "id">>;

export function mapDbClassToSchoolClass(row: DbClassRow): SchoolClass {
  return {
    id: row.id,
    name: row.name,
    teacherName: row.teacher_name ?? undefined,
    room: row.room ?? undefined,
    color: row.color ?? undefined,
    days: row.days ?? [],
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    meetings: row.meetings ?? undefined,
    scheduleLabel: row.schedule_label ?? undefined,
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

  return payload;
}

function emptyToNull(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
