import {
  formatTimeRange,
  getEffectiveDays,
  hasMixedTimes,
  sortedMeetings,
} from "../lib/schedule";
import { resolveClassColor } from "../lib/class-colors";
import {
  formatRotationBadge,
  getClassRotationDays,
  getRotationBadgeTone,
} from "../lib/class-rotation";
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
  /** Optional edit handler — shows an edit button when provided */
  onEdit?: () => void;
  /** Optional handler to open the Class Knowledge editor */
  onKnowledge?: () => void;
};

export function ScheduleCard({ schoolClass, onDelete, onEdit, onKnowledge }: ScheduleCardProps) {
  const effectiveDays = getEffectiveDays(schoolClass);
  const mixedTimes = hasMixedTimes(schoolClass);
  const meetings = sortedMeetings(schoolClass);
  const rotationBadge = formatRotationBadge(
    schoolClass.rotationDays,
    schoolClass.scheduleLabel,
  );
  const rotationDays = getClassRotationDays(schoolClass);
  const rotationBadgeClass =
    rotationDays.length === 2
      ? "bg-accent-green text-accent-green-foreground"
      : getRotationBadgeTone(schoolClass.scheduleLabel) === "blue"
        ? "bg-accent-blue text-accent-blue-foreground"
        : getRotationBadgeTone(schoolClass.scheduleLabel) === "purple"
          ? "bg-accent-purple text-accent-purple-foreground"
          : "bg-accent-green text-accent-green-foreground";

  return (
    <article
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-card-md"
      style={{
        borderLeftColor: resolveClassColor(schoolClass.color),
        borderLeftWidth: "4px",
      }}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground">{schoolClass.name}</h2>

              {/* A/B day badge */}
              {rotationBadge && (
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${rotationBadgeClass}`}
                >
                  {rotationBadge}
                </span>
              )}
              {/* AP badge */}
              {schoolClass.isApCourse && (
                <span className="inline-flex items-center rounded-full bg-accent-amber px-2 py-0.5 text-[11px] font-semibold text-accent-amber-foreground">
                  AP
                </span>
              )}
            </div>

            {(schoolClass.teacherName || schoolClass.room) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {schoolClass.teacherName && (
                  <span className="text-xs text-muted">
                    {schoolClass.teacherEmail ? (
                      <a
                        href={`mailto:${schoolClass.teacherEmail}`}
                        className="hover:underline hover:text-foreground transition-colors"
                        title={`Email ${schoolClass.teacherName}`}
                      >
                        {schoolClass.teacherName}
                      </a>
                    ) : (
                      schoolClass.teacherName
                    )}
                  </span>
                )}
                {schoolClass.teacherName && schoolClass.room && (
                  <span className="text-xs text-muted/40">·</span>
                )}
                {schoolClass.room && (
                  <span className="text-xs text-muted">{schoolClass.room}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {onKnowledge && (
              <button
                type="button"
                onClick={onKnowledge}
                title="Class knowledge"
                aria-label={`Edit knowledge for ${schoolClass.name}`}
                className={`rounded-full p-1.5 transition-colors hover:bg-surface ${
                  (schoolClass.syllabusText || schoolClass.classNotes || schoolClass.isApCourse)
                    ? "text-accent-green-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                title="Edit class"
                aria-label={`Edit ${schoolClass.name}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                title="Remove class"
                aria-label={`Remove ${schoolClass.name}`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
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

        {/* Notes — shown when present, truncated for card view */}
        {schoolClass.notes && (
          <p className="mt-3 border-t border-border/50 pt-2.5 text-xs text-muted line-clamp-2">
            {schoolClass.notes}
          </p>
        )}
      </div>
    </article>
  );
}
