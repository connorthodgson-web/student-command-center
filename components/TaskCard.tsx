// UI redesign pass
import { formatDueDate, isPast } from "../lib/datetime";
import type { SchoolClass, StudentTask } from "../types";

type TaskCardProps = {
  task: StudentTask;
  schoolClass?: SchoolClass;
  // Pass true when this card is rendered inside the "overdue" bucket
  isOverdue?: boolean;
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

export function TaskCard({ task, schoolClass, isOverdue = false }: TaskCardProps) {
  const borderColor = TYPE_BORDER[task.type ?? ""] ?? "border-l-accent-green-foreground";
  const typeBadge = TYPE_BADGE[task.type ?? ""] ?? "bg-accent-green text-accent-green-foreground";
  const statusBadge = STATUS_BADGE[task.status] ?? "bg-surface text-muted";

  // Show overdue chip if explicitly passed or if dueAt is in the past and not done
  const showOverdue =
    isOverdue ||
    (task.dueAt && task.status !== "done" && isPast(task.dueAt));

  return (
    <article
      className={`rounded-xl border border-border border-l-4 ${borderColor} bg-card p-4 hover:shadow-md transition-shadow`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground leading-snug">
            {task.title}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {schoolClass ? schoolClass.name : "General school task"}
            {task.dueAt ? ` • ${formatDueDate(task.dueAt)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {showOverdue && (
            <span className="rounded-full bg-accent-rose px-2.5 py-0.5 text-xs font-medium text-accent-rose-foreground">
              Overdue
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge}`}
          >
            {task.status.replace("_", " ")}
          </span>
          {task.type && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${typeBadge}`}
            >
              {task.type}
            </span>
          )}
        </div>
      </div>

      {task.description ? (
        <p className="mt-3 text-sm leading-6 text-muted">{task.description}</p>
      ) : null}
    </article>
  );
}
