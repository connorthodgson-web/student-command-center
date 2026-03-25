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
  /** Teacher's email address — used for drafting emails to teachers via the assistant. */
  teacherEmail?: string;
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
  /** Optional freeform notes about the class (syllabus info, grading policy, AI tutoring context). */
  notes?: string;
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

/**
 * Categories for special school calendar days.
 * - no_school: School is not in session (catch-all)
 * - holiday: Official holiday or break period
 * - teacher_workday: Staff day, no students
 * - special: Modified or special schedule day
 */
export type SchoolDayCategory = "no_school" | "holiday" | "teacher_workday" | "special";

/**
 * A single special-day entry in the student's school calendar.
 * Used to help the assistant understand when school is out, holidays,
 * and which A/B rotation applies on a given date.
 */
export interface SchoolCalendarEntry {
  id: string;
  /** ISO date string: YYYY-MM-DD */
  date: string;
  category: SchoolDayCategory;
  /** Optional human-readable label, e.g. "Spring Break", "Parent-Teacher Conferences" */
  label?: string;
  /** When set, forces A or B day type for this specific date */
  abOverride?: "A" | "B";
}

// ─── Automations ────────────────────────────────────────────────────────────

/**
 * The kind of automated action/reminder.
 * The assistant uses this to pick the right template and delivery logic.
 */
export type AutomationType =
  | "tonight_summary"   // Nightly digest of upcoming work
  | "morning_summary"   // Morning overview of today's tasks/classes
  | "due_soon"          // Alert when a task is due within N hours/days
  | "study_reminder"    // Recurring reminder to study for a specific class or topic
  | "class_reminder"    // Reminder before a class starts
  | "custom";           // Free-form automation set by the assistant

/** Where the reminder/automation is delivered. */
export type AutomationDeliveryChannel = "in_app" | "email" | "push";

/**
 * A single automation or reminder rule stored for the student.
 * Created primarily by the assistant; students can toggle/delete.
 */
export interface Automation {
  id: string;
  userId: string;
  type: AutomationType;
  title: string;
  /** Human-readable description of when this fires, e.g. "Every Sunday at 6:00 PM" */
  scheduleDescription: string;
  /**
   * Machine-readable schedule config.
   * Kept flexible (Record) for MVP — the assistant populates this when creating.
   * TODO: Define stricter subtypes as delivery logic is built out.
   */
  scheduleConfig: Record<string, unknown>;
  enabled: boolean;
  deliveryChannel: AutomationDeliveryChannel;
  /** Ties this automation to a specific class (optional). */
  relatedClassId?: string;
  /** Ties this automation to a specific task (optional). */
  relatedTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Assistant Actions ──────────────────────────────────────────────────────

/**
 * Structured action payload the assistant embeds in a chat response.
 * Parsed by the frontend to perform side effects like saving an automation.
 */
export interface CreateAutomationAction {
  type: "create_automation";
  automation: {
    userId: string;
    type: AutomationType;
    title: string;
    scheduleDescription: string;
    scheduleConfig: Record<string, unknown>;
    deliveryChannel: AutomationDeliveryChannel;
    enabled: boolean;
    relatedClassId?: string;
    relatedTaskId?: string;
  };
}

export type AssistantAction = CreateAutomationAction;
