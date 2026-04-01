import type { SchoolClass } from "../types";

export type AssistantIntent =
  | "materials"
  | "schedule"
  | "workload"
  | "next_step"
  | "task_capture"
  | "task_update"
  | "schedule_setup"
  | "general";

const MATERIAL_HINTS = [
  "notes",
  "note",
  "study guide",
  "handout",
  "review sheet",
  "materials",
  "document",
  "docs",
  "packet",
  "pdf",
];

const SCHEDULE_HINTS = [
  "schedule",
  "class today",
  "classes today",
  "a day",
  "b day",
  "what do i have",
  "when is my",
  "what's my next class",
];

const WORKLOAD_HINTS = [
  "due",
  "assignment",
  "homework",
  "essay",
  "project",
  "quiz",
  "test",
  "workload",
  "deadline",
  "overdue",
];

const NEXT_STEP_HINTS = [
  "what should i do next",
  "what should i work on",
  "where should i start",
  "what next",
  "what should i focus on",
  "help me prioritize",
  "what's most important",
  "what do i do first",
  "help me plan",
  "what should i study",
  "how do i start",
];

const TASK_CAPTURE_HINTS = [
  "add task",
  "remind me",
  "i need to",
  "i have to",
  "add homework",
  "log this task",
  "track my",
  "add a",
  "log a",
  "i have a",
  "i have an",
  "there's a",
  "there is a",
  "create a task",
  "log my",
  "save this task",
];

const TASK_UPDATE_HINTS = [
  "change the due date",
  "move the due date",
  "update my",
  "rename my",
  "change my",
  "edit my",
  "move my",
  "reschedule my",
  "change the notes",
  "update the notes",
  "change notes on",
  "rename the",
  "change the title",
  "push back my",
  "extend my",
  "push my",
  "delay my",
  "mark my",
  "set my",
];

const SCHEDULE_SETUP_HINTS = [
  "set up my schedule",
  "build my schedule",
  "help me set up my",
  "help me add my classes",
  "help me add my class schedule",
  "my classes are",
  "my schedule is",
  "add these classes",
  "add my classes",
  "my a-day classes",
  "my b-day classes",
  "set up my classes",
  "add a class",
  "add new class",
  "enter my schedule",
  "enter my classes",
  "update my schedule",
  "i need to add my classes",
  "here are my classes",
  "here's my schedule",
  "i have these classes",
];

export function detectAssistantIntent(message: string, classes: SchoolClass[]): AssistantIntent {
  const lower = message.toLowerCase();
  const mentionedClass = classes.some((schoolClass) =>
    lower.includes(schoolClass.name.toLowerCase()),
  );

  if (matchesHint(lower, SCHEDULE_SETUP_HINTS)) {
    return "schedule_setup";
  }

  if (matchesHint(lower, TASK_UPDATE_HINTS)) {
    return "task_update";
  }

  if (matchesHint(lower, TASK_CAPTURE_HINTS) && matchesHint(lower, WORKLOAD_HINTS)) {
    return "task_capture";
  }

  if (matchesHint(lower, MATERIAL_HINTS) || (mentionedClass && includesTopicQuestion(lower))) {
    return "materials";
  }

  if (matchesHint(lower, NEXT_STEP_HINTS)) {
    return "next_step";
  }

  if (matchesHint(lower, SCHEDULE_HINTS)) {
    return "schedule";
  }

  if (matchesHint(lower, WORKLOAD_HINTS)) {
    return "workload";
  }

  return "general";
}

function matchesHint(message: string, hints: string[]) {
  return hints.some((hint) => message.includes(hint));
}

function includesTopicQuestion(message: string) {
  return (
    message.includes("what does") ||
    message.includes("what do") ||
    message.includes("explain") ||
    message.includes("understand") ||
    message.includes("study")
  );
}
