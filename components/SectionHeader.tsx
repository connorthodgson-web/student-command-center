// UI redesign pass
import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  /** Optional action element rendered top-right (e.g. an "Add Class" button) */
  action?: ReactNode;
};

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[26px] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
