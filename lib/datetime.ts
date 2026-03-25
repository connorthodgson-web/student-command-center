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

export function formatDateTime(dateInput: string | Date) {
  const date = new Date(dateInput);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
