// UI redesign pass
import type { ChatMessage, ReminderPreference, SchoolClass, StudentTask } from "../types";

export const mockClasses: SchoolClass[] = [
  {
    id: "class-english",
    name: "English Literature",
    teacherName: "Ms. Patel",
    days: ["monday", "wednesday", "friday"],
    startTime: "09:00",
    endTime: "09:50",
    room: "Room 204",
    color: "#d4edd9",
  },
  {
    id: "class-biology",
    name: "Biology",
    teacherName: "Mr. Alvarez",
    // Biology meets Tue/Thu — Tue is a shorter lecture, Thu is the full lab period
    days: ["tuesday", "thursday"],
    startTime: "10:15",
    endTime: "11:05",
    meetings: [
      { day: "tuesday", startTime: "10:15", endTime: "11:05" },
      { day: "thursday", startTime: "10:15", endTime: "12:00" }, // lab day — runs longer
    ],
    room: "Lab 3",
    color: "#d4e6f7",
    rotationDays: ["B"],
    scheduleLabel: "B", // Biology only meets on B-rotation days at this school
  },
  {
    id: "class-history",
    name: "U.S. History",
    teacherName: "Mrs. Greene",
    days: ["monday", "wednesday"],
    startTime: "13:00",
    endTime: "14:15",
    room: "Room 118",
    color: "#fdefd3",
    rotationDays: ["A"],
    scheduleLabel: "A", // History meets on A-rotation days
  },
];

export const mockTasks: StudentTask[] = [
  {
    id: "task-1",
    title: "Great Gatsby essay draft",
    description: "Finish the first draft and double-check the thesis before submission.",
    classId: "class-english",
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
    status: "todo",
    source: "manual",
    type: "assignment",
    reminderAt: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
  },
  {
    id: "task-2",
    title: "Biology cell transport test",
    description: "Review membrane transport, diffusion, and the study guide packet.",
    classId: "class-biology",
    dueAt: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    status: "in_progress",
    source: "ai-parsed",
    type: "test",
    reminderAt: new Date(Date.now() + 1000 * 60 * 60 * 30).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
  {
    id: "task-3",
    title: "History reading notes",
    description: "Read chapter 8 and bring two discussion questions to class.",
    classId: "class-history",
    dueAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: "todo",
    source: "manual",
    type: "reading",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    id: "task-4",
    title: "Ask counselor about schedule change form",
    status: "todo",
    source: "chat",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "task-5",
    title: "Math worksheet corrections",
    description: "Redo the problems marked wrong before tomorrow's class.",
    dueAt: new Date().toISOString(),
    status: "done",
    source: "manual",
    type: "assignment",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

export const mockReminderPreference: ReminderPreference = {
  id: "reminder-pref-1",
  deliveryChannel: "in_app",
  dailySummaryEnabled: true,
  dailySummaryTime: "07:00",
  tonightSummaryEnabled: true,
  tonightSummaryTime: "18:30",
  dueSoonRemindersEnabled: true,
  dueSoonHoursBefore: 6,
};

export const mockChatMessages: ChatMessage[] = [
  {
    id: "chat-1",
    role: "assistant",
    content:
      "Hi! I can help you capture tasks, check what's due, and think through your week. What's on your mind?",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "chat-2",
    role: "user",
    content: "What do I still have left for English?",
    createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: "chat-3",
    role: "assistant",
    content:
      "For English Literature, you have the Great Gatsby essay draft due tomorrow afternoon — it's still marked as to-do. That's the only open English task right now.",
    createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
  },
];
