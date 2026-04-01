// UI redesign pass
import Link from "next/link";
import { formatDueDate, formatAssessmentDate, isPast } from "../lib/datetime";
import { resolveClassColor } from "../lib/class-colors";
import type { SchoolClass, StudentTask } from "../types";

type TaskCardProps = {
  task: StudentTask;
  schoolClass?: SchoolClass;
  // Pass true when this card is rendered inside the "overdue" bucket
  isOverdue?: boolean;
  // Pass true to trigger the fade-out animation before removal
  isRemoving?: boolean;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
};

const TYPE_BORDER: Record<string, string> = {
  assignment: "border-l-accent-blue-foreground",
  test: "border-l-accent-rose-foreground",
  quiz: "border-l-accent-purple-foreground",
  reading: "border-l-accent-amber-foreground",
};

const TYPE_BADGE: Record<string, string> = {
  assignment: "bg-accent-blue text-accent-blue-foreground",
  test: "bg-accent-rose text-accent-rose-foreground",
  quiz: "bg-accent-purple text-accent-purple-foreground",
  reading: "bg-accent-amber text-accent-amber-foreground",
};

const STATUS_BADGE: Record<string, string> = {
  todo: "bg-surface text-muted",
  in_progress: "bg-accent-amber text-accent-amber-foreground",
  done: "bg-accent-green text-accent-green-foreground",
};

export function TaskCard({ task, schoolClass, isOverdue = false, isRemoving = false, onComplete, onDelete }: TaskCardProps) {
  const borderColor = TYPE_BORDER[task.type ?? ""] ?? "border-l-accent-green-foreground";
  const typeBadge = TYPE_BADGE[task.type ?? ""] ?? "bg-accent-green text-accent-green-foreground";
  const statusBadge = STATUS_BADGE[task.status] ?? "bg-surface text-muted";

  // Show overdue chip if explicitly passed or if dueAt is in the past and not done
  const showOverdue =
    isOverdue ||
    (task.dueAt && task.status !== "done" && isPast(task.dueAt));

  const isDone = task.status === "done";

  // isRemoving fades the card out smoothly; isDone shows it at reduced opacity as confirmation
  const opacity = isRemoving ? 0 : isDone ? 0.6 : 1;
  const transition = isRemoving
    ? "opacity 0.5s ease, transform 0.5s ease, box-shadow 150ms ease"
    : "opacity 150ms ease, box-shadow 150ms ease";

  return (
    <article
      className={`group rounded-xl border border-border border-l-4 ${borderColor} bg-card p-4 hover:shadow-md ${
        isRemoving ? "pointer-events-none" : ""
      }`}
      style={{
        opacity,
        transition,
        transform: isRemoving ? "translateY(-2px)" : undefined,
        // Class color overrides the type-based Tailwind border color when available
        ...(schoolClass?.color ? { borderLeftColor: resolveClassColor(schoolClass.color) } : {}),
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          {/* Complete checkbox — larger touch target via negative margin + padding */}
          {onComplete && (
            <button
              type="button"
              onClick={() => onComplete(task.id)}
              disabled={isDone}
              title={isDone ? "Already completed" : "Mark as complete"}
              className={`-m-1 p-1 mt-[-2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                isDone
                  ? "border-accent-green-foreground/50 bg-accent-green/30 text-accent-green-foreground cursor-default"
                  : "border-border hover:border-accent-green-foreground/60 hover:bg-accent-green/10 text-transparent hover:text-accent-green-foreground"
              }`}
            >
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <div>
            <h3 className={`text-[15px] font-semibold leading-snug ${isDone ? "line-through text-muted" : "text-foreground"}`}>
              {task.title}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {schoolClass ? schoolClass.name : "General school task"}
              {task.dueAt
                ? task.type === "test" || task.type === "quiz"
                  ? ` • on ${formatAssessmentDate(task.dueAt)}`
                  : ` • ${formatDueDate(task.dueAt)}`
                : <span className="text-muted/50"> · no due date</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {showOverdue && (
            <span className="rounded-full bg-accent-rose px-2.5 py-0.5 text-xs font-medium text-accent-rose-foreground">
              Overdue
            </span>
          )}
          {task.status === "todo" && !showOverdue && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge}`}>
              To Do
            </span>
          )}
          {task.status === "in_progress" && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge}`}>
              In Progress
            </span>
          )}
          {task.status === "done" && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge}`}>
              Done ✓
            </span>
          )}
          {task.type && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadge}`}>
              {task.type === "assignment"
                ? "Assignment"
                : task.type === "test"
                  ? "Test"
                  : task.type === "quiz"
                    ? "Quiz"
                    : task.type === "reading"
                      ? "Reading"
                      : task.type === "project"
                        ? "Project"
                        : task.type === "study"
                          ? "Study"
                          : task.type}
            </span>
          )}
          {/* Delete button — always visible on mobile at reduced opacity, hover-reveal on desktop */}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(task.id)}
              title="Remove task"
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-40 transition-opacity group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-accent-rose/10 hover:text-accent-rose-foreground"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {task.description ? (
        <p className="mt-3 text-sm leading-6 text-muted">{task.description}</p>
      ) : null}

      {/* Study quick action — shown for test/quiz tasks that aren't done yet */}
      {!isDone && (task.type === "test" || task.type === "quiz") && (
        <div className="mt-3 flex items-center gap-2 opacity-60 transition-opacity group-hover:opacity-100">
          <Link
            href={`/chat?tutor=true&mode=quiz${task.classId ? `&classId=${task.classId}` : ""}&topic=${encodeURIComponent(task.title)}`}
            className="flex items-center gap-1 rounded-lg border border-accent-purple/30 bg-accent-purple/5 px-2.5 py-1 text-[11px] font-medium text-accent-purple-foreground transition hover:bg-accent-purple/10"
            onClick={(e) => e.stopPropagation()}
          >
            <span>🎯</span>
            Quiz Me
          </Link>
          <Link
            href={`/chat?tutor=true&mode=review${task.classId ? `&classId=${task.classId}` : ""}&topic=${encodeURIComponent(task.title)}`}
            className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition hover:border-sidebar-accent/30 hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <span>📖</span>
            Quick Review
          </Link>
        </div>
      )}
    </article>
  );
}
