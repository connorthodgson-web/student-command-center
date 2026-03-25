export interface LifeConstraint {
  id: string;
  text: string;         // Raw user input, e.g. "Dentist tomorrow at 3"
  date?: string;        // ISO date string YYYY-MM-DD, if detected
  timeRange?: string;   // Optional time info, e.g. "3:00 PM"
  createdAt: string;
}

const STORAGE_KEY = "scc_constraints";

export function loadConstraints(): LifeConstraint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LifeConstraint[];
  } catch {
    return [];
  }
}

export function saveConstraints(constraints: LifeConstraint[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(constraints));
}

/**
 * Returns constraints that are relevant for the assistant context:
 * - Constraints with a date within the next 7 days
 * - Constraints with no date (always potentially relevant)
 * Most recent first.
 */
export function getRelevantConstraints(constraints: LifeConstraint[]): LifeConstraint[] {
  const now = new Date();
  const todayStr = toDateStr(now);
  const weekOut = new Date(now);
  weekOut.setDate(weekOut.getDate() + 7);
  const weekOutStr = toDateStr(weekOut);

  return constraints
    .filter((c) => {
      if (!c.date) return true; // no date = always include
      return c.date >= todayStr && c.date <= weekOutStr;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Tries to extract a date from plain-text constraint input.
 * Handles: "today", "tomorrow", day names like "Friday", "Saturday morning"
 */
export function extractDateFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  const now = new Date();

  if (lower.includes("today")) return toDateStr(now);

  if (lower.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toDateStr(d);
  }

  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  for (const [i, name] of dayNames.entries()) {
    if (lower.includes(name)) {
      const current = now.getDay();
      let diff = i - current;
      if (diff <= 0) diff += 7; // next occurrence
      const d = new Date(now);
      d.setDate(d.getDate() + diff);
      return toDateStr(d);
    }
  }

  return undefined;
}
