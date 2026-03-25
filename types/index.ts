// UI redesign pass
export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/**
 * A single meeting slot for a class on a specific weekday.
 * Used when a class meets at different times on different days
 * (e.g. shorter on Mon/Wed, longer lab on Friday).
 */
export interface ClassMeetingTime {
  day: Weekday;
  startTime: string; // "HH:MM" 24-hour
  endTime: string;   // "HH:MM" 24-hour
}

export interface SchoolClass {
  id: string;
  name: string;
  teacherName?: string;
  /** Days this class meets (derived from meetings if present, else direct). */
  days: Weekday[];
  /** Canonical start/end — used when all days share the same time. */
  startTime: string;
  endTime: string;
  /**
   * Optional per-day schedule. When present, overrides startTime/endTime for
   * each day listed. Enables realistic schedules where times differ by day
   * (e.g. lecture M/W vs. lab F) and lays groundwork for A/B-day support.
   */
  meetings?: ClassMeetingTime[];
  room?: string;
  color?: string;
  /**
   * A/B day rotation label for schools using rotating schedules.
   * "A" = this class meets on A-rotation days, "B" = B-rotation days.
   * undefined = standard schedule (meets every scheduled day).
   */
  scheduleLabel?: "A" | "B";
}

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskType = "assignment" | "test" | "quiz" | "reading" | "project" | "study";

export type TaskSource = "manual" | "ai-parsed" | "chat" | "imported";

export interface StudentTask {
  id: string;
  title: string;
  description?: string;
  classId?: string;
  dueAt?: string;
  status: TaskStatus;
  source: TaskSource;
  type?: TaskType;
  reminderAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderPreference {
  id: string;
  dailySummaryEnabled: boolean;
  dailySummaryTime?: string;
  tonightSummaryEnabled: boolean;
  tonightSummaryTime?: string;
  dueSoonRemindersEnabled: boolean;
  dueSoonHoursBefore?: number;
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}
