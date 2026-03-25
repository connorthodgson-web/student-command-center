// UI redesign pass
import { formatDueDate } from "../lib/datetime";
import type { SchoolClass, StudentTask } from "../types";

type NextTaskCardProps = {
  task?: StudentTask;
  schoolClass?: SchoolClass;
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

export function NextTaskCard({ task, schoolClass }: NextTaskCardProps) {
  const borderColor = TYPE_BORDER[task?.type ?? ""] ?? "border-l-accent-green-foreground";
  const typeBadge = TYPE_BADGE[task?.type ?? ""] ?? "bg-accent-green text-accent-green-foreground";

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Up Next</h2>
        {task?.type && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${typeBadge}`}>
            {task.type}
          </span>
        )}
      </div>

      {task ? (
        <div className={`mt-4 rounded-xl border border-border border-l-4 ${borderColor} bg-background p-4`}>
          <h3 className="text-[15px] font-semibold text-foreground">{task.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {schoolClass ? schoolClass.name : "General school task"}
            {task.dueAt ? ` · Due ${formatDueDate(task.dueAt)}` : " · No due date"}
          </p>
          {task.description ? (
            <p className="mt-3 text-sm leading-6 text-muted">{task.description}</p>
          ) : null}

          {/* Non-functional CTA — placeholder for a future status change flow */}
          <button
            type="button"
            className="mt-4 rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-accent-green-foreground transition-opacity hover:opacity-80"
          >
            Start working →
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-background p-5 text-center">
          <p className="text-sm font-medium text-foreground/60">You&apos;re all caught up.</p>
          <p className="mt-1 text-xs text-muted">
            Tell the assistant about a new assignment or test to get started.
          </p>
        </div>
      )}
    </section>
  );
}
