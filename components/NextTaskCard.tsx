// UI redesign pass
import Link from "next/link";
import { formatDueDate } from "../lib/datetime";
import { resolveClassColor } from "../lib/class-colors";
import type { SchoolClass, StudentTask, TutoringMode } from "../types";

function studyModeForTask(type?: string): TutoringMode {
  if (type === "test" || type === "quiz") return "quiz";
  if (type === "reading") return "explain";
  if (type === "project") return "study_plan";
  return "homework_help";
}

function studyLabelForTask(type?: string): string {
  if (type === "test" || type === "quiz") return "Quiz Me →";
  if (type === "reading") return "Explain It →";
  if (type === "project") return "Study Plan →";
  return "Get Help →";
}

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
        <div
          className={`mt-4 rounded-xl border border-border border-l-4 ${borderColor} bg-background p-4`}
          style={schoolClass?.color ? { borderLeftColor: resolveClassColor(schoolClass.color) } : undefined}
        >
          <h3 className="text-[15px] font-semibold text-foreground">{task.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {schoolClass ? schoolClass.name : "General school task"}
            {task.dueAt ? ` · Due ${formatDueDate(task.dueAt)}` : " · No due date"}
          </p>
          {task.description ? (
            <p className="mt-3 text-sm leading-6 text-muted">{task.description}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/chat?tutor=true&mode=${studyModeForTask(task.type)}${task.classId ? `&classId=${task.classId}` : ""}&topic=${encodeURIComponent(task.title)}`}
              className="rounded-lg bg-accent-green px-4 py-2 text-sm font-medium text-accent-green-foreground transition-opacity hover:opacity-80"
            >
              {studyLabelForTask(task.type)}
            </Link>
            <Link
              href={`/chat?q=${encodeURIComponent(`Help me with: ${task.title}`)}`}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface hover:text-foreground"
            >
              Ask assistant
            </Link>
          </div>
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
