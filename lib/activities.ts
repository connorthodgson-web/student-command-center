import type { Weekday } from "../types";

export interface Activity {
  id: string;
  title: string;
  daysOfWeek: Weekday[];
  startTime: string; // "HH:MM" 24-hour
  endTime: string;   // "HH:MM" 24-hour
  location?: string;
  notes?: string;
  createdAt: string;
}

const STORAGE_KEY = "scc_activities";

export function loadActivities(): Activity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Activity[];
  } catch {
    return [];
  }
}

export function saveActivities(activities: Activity[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
}

export function getTodayActivities(activities: Activity[]): Activity[] {
  const dayMap: Weekday[] = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ];
  const todayWeekday = dayMap[new Date().getDay()];
  return activities.filter((a) => a.daysOfWeek.includes(todayWeekday));
}

// ── Natural-language parser ────────────────────────────────────────────────────

const DAY_ALIASES: Record<string, Weekday> = {
  monday: "monday",   mon: "monday",    mondays: "monday",
  tuesday: "tuesday", tue: "tuesday",   tues: "tuesday",   tuesdays: "tuesday",
  wednesday: "wednesday", wed: "wednesday", wednesdays: "wednesday",
  thursday: "thursday", thu: "thursday",  thur: "thursday",  thurs: "thursday", thursdays: "thursday",
  friday: "friday",   fri: "friday",    fridays: "friday",
  saturday: "saturday", sat: "saturday",  saturdays: "saturday",
  sunday: "sunday",   sun: "sunday",    sundays: "sunday",
};

function parseTime(raw: string): string | null {
  // Accepts: "7:30", "7:30am", "7:30 am", "7", "19:00", "3pm", "3:00 PM"
  const clean = raw.trim().toLowerCase();
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2] ?? "0", 10);
  const meridiem = match[3];

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  // Heuristic: bare hour with no meridiem — assume PM if 1–6, AM otherwise
  if (!meridiem) {
    if (hour >= 1 && hour <= 6) hour += 12;
  }

  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export interface ParsedActivity {
  title: string;
  daysOfWeek: Weekday[];
  startTime: string;
  endTime: string;
}

export interface ParseActivityResult {
  success: true;
  data: ParsedActivity;
} | {
  success: false;
  error: string;
}

export function parseActivityInput(input: string): { success: true; data: ParsedActivity } | { success: false; error: string } {
  const text = input.trim();
  if (!text) return { success: false, error: "Please enter an activity description." };

  // ── Extract days ───────────────────────────────────────────────────────────
  const foundDays: Weekday[] = [];
  const dayPattern = new RegExp(
    `\\b(${Object.keys(DAY_ALIASES).join("|")})\\b`,
    "gi"
  );
  const textWithoutDays = text.replace(dayPattern, (match) => {
    const day = DAY_ALIASES[match.toLowerCase()];
    if (day && !foundDays.includes(day)) foundDays.push(day);
    return " ";
  });

  if (foundDays.length === 0) {
    return { success: false, error: "Couldn't find any days. Try: \"Basketball Tue/Thu 7:30-9\"" };
  }

  // ── Extract time range ─────────────────────────────────────────────────────
  // Patterns: "7:30 to 9", "7:30–9", "7:30-9", "7:30 - 9:00", "7:30pm to 9pm"
  const timeRangePattern = /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|–|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;
  const timeRangeMatch = textWithoutDays.match(timeRangePattern);

  if (!timeRangeMatch) {
    return { success: false, error: "Couldn't find a time range. Try: \"Basketball Tue/Thu 7:30–9\"" };
  }

  const startTime = parseTime(timeRangeMatch[1]);
  const endTime = parseTime(timeRangeMatch[2]);

  if (!startTime || !endTime) {
    return { success: false, error: "Couldn't parse the times. Use formats like 7:30, 9pm, or 14:00." };
  }

  // ── Extract title ──────────────────────────────────────────────────────────
  // Remove the time range from the cleaned text, then trim remaining words
  const withoutTime = textWithoutDays.replace(timeRangePattern, " ").trim();
  // Strip leftover punctuation/connectors
  const title = withoutTime.replace(/\s*(every|and|&|,|\/)\s*/gi, " ").replace(/\s{2,}/g, " ").trim();

  if (!title) {
    return { success: false, error: "Couldn't find an activity name. Start with the name: \"Basketball Tue/Thu 7:30–9\"" };
  }

  return {
    success: true,
    data: { title, daysOfWeek: foundDays, startTime, endTime },
  };
}

export function formatActivityDays(days: Weekday[]): string {
  const order: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const abbr: Record<Weekday, string> = {
    monday: "Mon", tuesday: "Tue", wednesday: "Wed",
    thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun",
  };
  return days
    .slice()
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((d) => abbr[d])
    .join(", ");
}

export function formatActivityTime(startTime: string, endTime: string): string {
  function fmt(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${hour} ${period}` : `${hour}:${String(m).padStart(2, "0")} ${period}`;
  }
  return `${fmt(startTime)} – ${fmt(endTime)}`;
}
