const WEEKDAY_PATTERN =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const RELATIVE_DAY_PATTERN =
  /\b(today|tomorrow|tmr|next\s+(?:week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:week|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;
const MONTH_PATTERN =
  /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\b/i;
const NUMERIC_DATE_PATTERN = /\b\d{1,4}[/-]\d{1,2}(?:[/-]\d{1,4})?\b/;
const ISO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const SPECIFIC_TIME_PATTERN =
  /\b(?:at\s*)?(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:a\.?m\.?|p\.?m\.?)\b|\b(?:[01]?\d|2[0-3]):[0-5]\d\b|\b(noon|midnight)\b/i;

export function sanitizeTaskDueAtFromInput(input: string, dueAt?: string | null) {
  const normalizedInput = input.trim();
  if (!normalizedInput || !dueAt) {
    return undefined;
  }

  const parsedDueAt = new Date(dueAt);
  if (Number.isNaN(parsedDueAt.getTime())) {
    return undefined;
  }

  if (!mentionsCalendarDate(normalizedInput)) {
    return undefined;
  }

  if (mentionsSpecificTime(normalizedInput)) {
    return parsedDueAt.toISOString();
  }

  // When the student gave a date but no time, make the default honest and predictable.
  return new Date(
    parsedDueAt.getFullYear(),
    parsedDueAt.getMonth(),
    parsedDueAt.getDate(),
    23,
    59,
    0,
    0,
  ).toISOString();
}

function mentionsCalendarDate(input: string) {
  return (
    RELATIVE_DAY_PATTERN.test(input) ||
    WEEKDAY_PATTERN.test(input) ||
    MONTH_PATTERN.test(input) ||
    NUMERIC_DATE_PATTERN.test(input) ||
    ISO_DATE_PATTERN.test(input)
  );
}

function mentionsSpecificTime(input: string) {
  return SPECIFIC_TIME_PATTERN.test(input);
}
