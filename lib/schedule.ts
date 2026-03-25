// UI redesign pass
import type { ClassMeetingTime, SchoolClass, Weekday } from "../types";

const weekdayLabels: Record<Weekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

// Ordered for display / sort purposes
const WEEKDAY_ORDER: Weekday[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

/**
 * Returns the days this class meets.
 * Uses the meetings array when present (for per-day schedules),
 * otherwise falls back to the flat days array.
 */
export function getEffectiveDays(schoolClass: SchoolClass): Weekday[] {
  if (schoolClass.meetings && schoolClass.meetings.length > 0) {
    return schoolClass.meetings.map((m) => m.day);
  }
  return schoolClass.days;
}

/**
 * Returns the start/end time for this class on a specific day.
 * Uses the meetings array override if present, else falls back to global times.
 */
export function getClassTimeForDay(
  schoolClass: SchoolClass,
  day: Weekday
): { startTime: string; endTime: string } | null {
  if (schoolClass.meetings) {
    const meeting = schoolClass.meetings.find((m) => m.day === day);
    if (meeting) return { startTime: meeting.startTime, endTime: meeting.endTime };
  }
  if (schoolClass.days.includes(day) && schoolClass.startTime) {
    return { startTime: schoolClass.startTime, endTime: schoolClass.endTime };
  }
  return null;
}

/**
 * Returns all classes that meet on the given weekday.
 * Respects per-day meetings when present.
 */
export function getClassesOnDay(classes: SchoolClass[], day: Weekday): SchoolClass[] {
  return classes
    .filter((c) => getEffectiveDays(c).includes(day))
    .sort((a, b) => {
      const aTime = getClassTimeForDay(a, day)?.startTime ?? "";
      const bTime = getClassTimeForDay(b, day)?.startTime ?? "";
      return aTime.localeCompare(bTime);
    });
}

/**
 * Returns true when the class has meetings with differing times across days.
 * Used to decide whether to show a per-day breakdown in the UI.
 */
export function hasMixedTimes(schoolClass: SchoolClass): boolean {
  if (!schoolClass.meetings || schoolClass.meetings.length <= 1) return false;
  const first = `${schoolClass.meetings[0].startTime}-${schoolClass.meetings[0].endTime}`;
  return schoolClass.meetings.some(
    (m) => `${m.startTime}-${m.endTime}` !== first
  );
}

/**
 * Returns the meetings array sorted by weekday order, or an empty array.
 */
export function sortedMeetings(schoolClass: SchoolClass): ClassMeetingTime[] {
  if (!schoolClass.meetings) return [];
  return [...schoolClass.meetings].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day)
  );
}

/**
 * Returns today's weekday as a Weekday string.
 * Safe to call client-side (uses browser Date).
 */
export function getCurrentWeekday(): Weekday {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon, ...
  const map: Weekday[] = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ];
  return map[jsDay];
}

export function formatClassMeetingDays(days: Weekday[]) {
  if (days.length === 0) {
    return "No meeting days set";
  }
  return days.map((day) => weekdayLabels[day]).join(", ");
}

export function formatTimeRange(startTime: string, endTime: string) {
  if (!startTime || !endTime) return "Time not set";
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

export function classMeetsOnDay(schoolClass: SchoolClass, day: Weekday): boolean {
  return getEffectiveDays(schoolClass).includes(day);
}

/**
 * Returns classes that meet on a given weekday with A/B day awareness.
 *
 * Logic:
 * - Standard classes (no scheduleLabel): shown when their weekday matches.
 * - A/B classes with specific days: shown when scheduleLabel AND weekday both match.
 * - A/B classes with no specific days (pure rotation): shown when dayType matches their label.
 * - If dayType is null and a class has scheduleLabel but no days: hidden (day type unknown).
 *
 * Use this on the dashboard instead of getClassesOnDay when A/B rotation is in play.
 */
export function getClassesForToday(
  classes: SchoolClass[],
  day: Weekday,
  dayType: "A" | "B" | null
): SchoolClass[] {
  return classes
    .filter((c) => {
      const effectiveDays = getEffectiveDays(c);
      const hasSpecificDays = effectiveDays.length > 0;

      if (c.scheduleLabel) {
        if (dayType && c.scheduleLabel !== dayType) return false; // Wrong rotation
        if (hasSpecificDays) return effectiveDays.includes(day);
        // Pure A/B class — show if we know the day type, hide otherwise
        return dayType !== null;
      }

      // Standard class — just weekday matching
      return hasSpecificDays && effectiveDays.includes(day);
    })
    .sort((a, b) => {
      const aTime = getClassTimeForDay(a, day)?.startTime ?? "";
      const bTime = getClassTimeForDay(b, day)?.startTime ?? "";
      return aTime.localeCompare(bTime);
    });
}

function formatTime(value: string) {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${minutes.toString().padStart(2, "0")} ${suffix}`;
}
