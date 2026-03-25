// UI redesign pass
import {
  formatTimeRange,
  getEffectiveDays,
  hasMixedTimes,
  sortedMeetings,
} from "../lib/schedule";
import type { SchoolClass } from "../types";

const DAY_ABBR: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

type ScheduleCardProps = {
  schoolClass: SchoolClass;
  /** Optional delete handler — shows a remove button when provided */
  onDelete?: () => void;
};

export function ScheduleCard({ schoolClass, onDelete }: ScheduleCardProps) {
  const effectiveDays = getEffectiveDays(schoolClass);
  const mixedTimes = hasMixedTimes(schoolClass);
  const meetings = sortedMeetings(schoolClass);

  return (
    <article className="flex overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Left color bar */}
      <div
        className="w-1.5 shrink-0"
        style={{ backgroundColor: schoolClass.color ?? "#d4edd9" }}
      />

      <div className="flex-1 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground">{schoolClass.name}</h2>

              {/* A/B day badge */}
              {schoolClass.scheduleLabel && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    schoolClass.scheduleLabel === "A"
                      ? "bg-accent-blue text-accent-blue-foreground"
                      : "bg-accent-purple text-accent-purple-foreground"
                  }`}
                >
                  {schoolClass.scheduleLabel}-Day
                </span>
              )}
            </div>

            {(schoolClass.teacherName || schoolClass.room) && (
              <p className="mt-0.5 text-xs text-muted">
                {[
                  schoolClass.teacherName,
                  schoolClass.room ? `${schoolClass.room}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
              title="Remove class"
              aria-label={`Remove ${schoolClass.name}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Day pills */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {effectiveDays.map((day) => (
            <span
              key={day}
              className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted"
            >
              {DAY_ABBR[day] ?? day}
            </span>
          ))}
          {effectiveDays.length === 0 && (
            <span className="text-xs text-muted">No days set</span>
          )}
        </div>

        {/* Time display */}
        <div className="mt-3">
          {mixedTimes ? (
            // Per-day breakdown when times differ across days
            <div className="space-y-1">
              {meetings.map((m) => (
                <div key={m.day} className="flex items-center gap-2 text-sm">
                  <span className="w-7 shrink-0 text-xs font-medium text-muted">
                    {DAY_ABBR[m.day] ?? m.day}
                  </span>
                  <span className="text-foreground">
                    {formatTimeRange(m.startTime, m.endTime)}
                  </span>
                </div>
              ))}
            </div>
          ) : schoolClass.startTime ? (
            <p className="text-sm text-foreground">
              {formatTimeRange(schoolClass.startTime, schoolClass.endTime)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
