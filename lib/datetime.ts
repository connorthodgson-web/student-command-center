/**
 * Formats an ISO date string into a friendly, human-readable due date string.
 * Examples:
 *   - Same calendar day  → "Today at 8:00 PM"
 *   - Next calendar day  → "Tomorrow at 11:59 PM"
 *   - Within 7 days      → "Friday at 8:00 PM"
 *   - Further out        → "Fri, Mar 28 at 8:00 PM"
 *   - Undefined/invalid  → "No due date"
 *
 * TODO: Add timezone awareness once the user's local timezone is stored in preferences.
 */
export function formatDueDate(isoString: string | undefined | null): string {
  if (!isoString) return "No due date";

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (dateStart.getTime() === todayStart.getTime()) {
    return `Today at ${timeStr}`;
  }

  if (dateStart.getTime() === tomorrowStart.getTime()) {
    return `Tomorrow at ${timeStr}`;
  }

  if (dateStart < sevenDaysOut) {
    const dayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
    return `${dayName} at ${timeStr}`;
  }

  const dateStr = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  return `${dateStr} at ${timeStr}`;
}

export function formatDate(dateInput: string | Date) {
  const date = new Date(dateInput);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Formats an ISO date string into a human-readable datetime string.
 * Returns "Today at 3:14 PM", "Tomorrow at 11:59 PM", or "Mon Mar 11 at 11:59 PM".
 */
export function formatDateTime(dateInput: string | Date): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const timeStr = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (dateStart.getTime() === todayStart.getTime()) {
    return `Today at ${timeStr}`;
  }

  if (dateStart.getTime() === tomorrowStart.getTime()) {
    return `Tomorrow at ${timeStr}`;
  }

  const dateStr = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  return `${dateStr} at ${timeStr}`;
}

/**
 * Formats an ISO date for an assessment (test/quiz/exam).
 * Shows the day or date WITHOUT a time component, since assessments have a date, not a due time.
 * Examples:
 *   - Same day   → "Today"
 *   - Next day   → "Tomorrow"
 *   - Within 7d  → "Friday"
 *   - Further    → "Fri, Apr 3"
 */
export function formatAssessmentDate(isoString: string | undefined | null): string {
  if (!isoString) return "No date set";

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "Invalid date";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const sevenDaysOut = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateStart.getTime() === todayStart.getTime()) return "Today";
  if (dateStart.getTime() === tomorrowStart.getTime()) return "Tomorrow";

  if (dateStart < sevenDaysOut) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function isToday(dateInput: string | Date) {
  const date = new Date(dateInput);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function isPast(dateInput: string | Date) {
  return new Date(dateInput).getTime() < Date.now();
}

/**
 * Returns true only when the due date falls strictly before the start of today
 * (i.e. midnight this morning). A task due later today is NOT treated as overdue.
 * This avoids the harsh UX of tasks flipping to "Overdue" mid-day.
 *
 * TODO: Once user timezone preference exists, pass it here instead of relying on browser local time.
 */
export function isBeforeToday(isoString: string): boolean {
  const due = new Date(isoString);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return due < startOfToday;
}
