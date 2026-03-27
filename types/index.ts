export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type RotationDay = "A" | "B";

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

export type ClassMaterialKind = "file" | "note";
export type ClassMaterialExtractionStatus =
  | "completed"
  | "failed"
  | "not_supported"
  | "not_needed";

/**
 * Metadata for a class-linked material.
 * Files live in Supabase Storage; pasted notes live directly in the database.
 */
export interface ClassMaterial {
  id: string;
  userId: string;
  classId: string;
  kind: ClassMaterialKind;
  title: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  rawText?: string;
  extractedText?: string;
  extractionStatus?: ClassMaterialExtractionStatus;
  extractionError?: string;
  createdAt: string;
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
   * A/B rotation membership for schools using rotating schedules.
   * [] or undefined = standard weekday-based class.
   * ["A"] = A-day only, ["B"] = B-day only, ["A","B"] = both A and B days.
   */
  rotationDays?: RotationDay[];
  /**
   * Legacy single-value alias kept for compatibility with older UI/state code.
   * Prefer rotationDays for new logic.
   */
  scheduleLabel?: RotationDay;
  /** Optional freeform notes about the class (syllabus info, grading policy, AI tutoring context). */
  notes?: string;
  /** Syllabus or course overview text — used by the assistant for class-specific context. */
  syllabusText?: string;
  /** Student's own class notes or context — supplements the assistant's understanding. */
  classNotes?: string;
  /** True when the class has been identified as an AP course. */
  isApCourse?: boolean;
  /** Key into AP_COURSE_TEMPLATES for built-in AP knowledge pack. Null if AP but no template match. */
  apCourseKey?: string | null;
  materials?: ClassMaterial[];
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
  userId?: string;
  dailySummaryEnabled: boolean;
  dailySummaryTime?: string;
  tonightSummaryEnabled: boolean;
  tonightSummaryTime?: string;
  dueSoonRemindersEnabled: boolean;
  dueSoonHoursBefore?: number;
  deliveryChannel: ReminderDeliveryChannel;
  createdAt?: string;
  updatedAt?: string;
}

export type ChatRole = "system" | "user" | "assistant";

/** Confirmation payload attached to assistant messages that performed a task action. */
export interface ChatMessageActionResult {
  type: "task_added" | "task_updated";
  title: string;
  dueAt?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  /** Set to true when the message represents a failed AI response. */
  failed?: boolean;
  /** Set when the assistant successfully performed an add_task or update_task action. */
  actionResult?: ChatMessageActionResult;
}

export type AssistantSessionChannel =
  | "web_chat"
  | "voice"
  | "messaging"
  | "mobile"
  | "tutoring";

export type AssistantSessionStatus = "active" | "archived";
export type AssistantMessageRole = "system" | "user" | "assistant";
export type AssistantMessageContentType =
  | "text"
  | "voice_transcript"
  | "messaging_text"
  | "attachment_note";
export type AssistantEventType =
  | "session_started"
  | "message_added"
  | "assistant_response_generated"
  | "attachment_added"
  | "tutoring_session_created"
  | "voice_transcript_submitted";
export type AssistantAttachmentType = "image" | "file" | "audio" | "document";
export type AssistantAttachmentAnalysisStatus =
  | "pending"
  | "completed"
  | "failed"
  | "not_requested";
export type AssistantAttachmentProcessingStatus =
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";
export type TutoringMode =
  | "explain"
  | "step_by_step"
  | "quiz"
  | "review"
  | "study_plan"
  | "homework_help";

export interface TutoringContext {
  mode?: TutoringMode;
  classId?: string;
  taskId?: string;
  materialIds?: string[];
  attachmentIds?: string[];
  topic?: string;
  goal?: string;
  studyFocus?: string;
}

export interface AssistantAttachment {
  id: string;
  userId: string;
  sessionId?: string;
  messageId?: string;
  classId?: string;
  taskId?: string;
  attachmentType: AssistantAttachmentType;
  title: string;
  fileName?: string;
  mimeType?: string;
  storagePath: string;
  fileSizeBytes?: number;
  extractedText?: string;
  extractionError?: string;
  processingStatus: AssistantAttachmentProcessingStatus;
  analysisStatus: AssistantAttachmentAnalysisStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface AssistantSession {
  id: string;
  userId: string;
  channel: AssistantSessionChannel;
  status: AssistantSessionStatus;
  title?: string;
  classId?: string;
  taskId?: string;
  tutoringMode?: TutoringMode;
  topic?: string;
  goal?: string;
  studyFocus?: string;
  tutoringContext?: TutoringContext;
  metadata?: Record<string, unknown>;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantSessionMessage {
  id: string;
  sessionId: string;
  userId: string;
  role: AssistantMessageRole;
  contentType: AssistantMessageContentType;
  content: string;
  metadata?: Record<string, unknown>;
  attachments?: AssistantAttachment[];
  createdAt: string;
}

export interface AssistantSessionEvent {
  id: string;
  sessionId: string;
  userId: string;
  eventType: AssistantEventType;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AssistantSessionInput {
  id?: string;
  channel?: AssistantSessionChannel;
  title?: string;
  classId?: string;
  taskId?: string;
  tutoringMode?: TutoringMode;
  topic?: string;
  goal?: string;
  studyFocus?: string;
  tutoringContext?: TutoringContext;
  metadata?: Record<string, unknown>;
}

export interface AssistantRequestInput {
  message: string;
  source?: AssistantMessageContentType;
  channel?: AssistantSessionChannel;
  session?: AssistantSessionInput;
  classId?: string;
  taskId?: string;
  attachmentIds?: string[];
  attachments?: AssistantAttachment[];
  tutoringMode?: TutoringMode;
  tutoringContext?: TutoringContext;
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

/**
 * Action to mark a task as completed via assistant chat.
 * The assistant may supply taskId (preferred) or taskTitle for fuzzy matching.
 */
export interface CompleteTaskAction {
  type: "complete_task";
  /** Exact task id when the assistant has it from context. */
  taskId?: string;
  /** Human-readable title used for fuzzy matching when id is unavailable. */
  taskTitle?: string;
}

/**
 * Action to update an existing task's fields via assistant chat.
 * Only changed fields need to be present in `updates`.
 */
export interface UpdateTaskAction {
  type: "update_task";
  /** Exact task id when the assistant has it from context. */
  taskId?: string;
  /** Human-readable title used for fuzzy matching when id is unavailable. */
  taskTitle?: string;
  updates: {
    title?: string;
    dueAt?: string | null;
    description?: string | null;
    status?: TaskStatus;
  };
}

/**
 * Action to add a new task directly from chat without leaving the assistant.
 * className is resolved to classId by the frontend via fuzzy matching.
 */
export interface AddTaskFromChatAction {
  type: "add_task";
  task: {
    title: string;
    dueAt?: string | null;
    description?: string | null;
    type?: TaskType | null;
    /** Class name string — frontend resolves to classId via fuzzy match. */
    className?: string | null;
  };
}

export type AssistantAction = CreateAutomationAction | CompleteTaskAction | UpdateTaskAction | AddTaskFromChatAction;

export type ReminderDeliveryChannel = "in_app" | "sms";
export type MessagingChannelType = "sms" | "web" | "email" | "test";
export type MessagingConversationStatus = "active" | "archived";
export type MessagingDirection = "inbound" | "outbound";
export type MessagingAuthorRole = "user" | "assistant" | "system";
export type MessagingDeliveryStatus =
  | "received"
  | "processing"
  | "queued"
  | "sent"
  | "delivered"
  | "failed";
export type MessagingVerificationStatus = "not_started" | "pending" | "verified" | "failed";

export interface MessagingEndpoint {
  id: string;
  userId: string;
  channelType: MessagingChannelType;
  providerKey?: string;
  address: string;
  label?: string;
  isActive: boolean;
  isPreferred: boolean;
  verificationStatus: MessagingVerificationStatus;
  verifiedAt?: string;
  verificationExpiresAt?: string;
  verificationAttemptCount?: number;
  lastVerificationSentAt?: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessagingConversation {
  id: string;
  userId: string;
  endpointId?: string;
  assistantSessionId?: string;
  channelType: MessagingChannelType;
  providerKey?: string;
  status: MessagingConversationStatus;
  participantAddress?: string;
  assistantAddress?: string;
  title?: string;
  providerThreadId?: string;
  externalReference?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessagingMessage {
  id: string;
  conversationId: string;
  userId: string;
  channelType: MessagingChannelType;
  providerKey?: string;
  providerMessageId?: string;
  direction: MessagingDirection;
  authorRole: MessagingAuthorRole;
  deliveryStatus: MessagingDeliveryStatus;
  content: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  sentAt?: string;
  deliveredAt?: string;
  createdAt: string;
}
