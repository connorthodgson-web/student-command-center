import React from "react";

/**
 * Shared markdown renderer used by ChatPanel and TodayFocusCard.
 * Handles: ### headings, **bold** headings, bullet lists (- / *), inline bold, inline links.
 */

export function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return <strong key={i} className="font-semibold text-foreground">{boldMatch[1]}</strong>;
        }
        const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <a key={i} href={linkMatch[2]} className="underline underline-offset-2 text-accent-green-foreground hover:opacity-80">
              {linkMatch[1]}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

export function renderContent(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let bulletBuffer: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bulletBuffer.length === 0) return;
    nodes.push(
      <ul key={key++} className="mt-1.5 mb-1 space-y-1 pl-1">
        {bulletBuffer.map((b, i) => (
          <li key={i} className="flex items-start gap-2 leading-snug">
            <span className="mt-[4px] shrink-0 h-1.5 w-1.5 rounded-full bg-muted/50" />
            <span>{renderInline(b)}</span>
          </li>
        ))}
      </ul>
    );
    bulletBuffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^###\s+(.+)/);
    if (headingMatch) {
      flushBullets();
      nodes.push(
        <p key={key++} className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {headingMatch[1]}
        </p>
      );
      continue;
    }

    const standaloneBoldMatch = line.match(/^\*\*([^*]+)\*\*\s*$/);
    if (standaloneBoldMatch) {
      flushBullets();
      nodes.push(
        <p key={key++} className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
          {standaloneBoldMatch[1]}
        </p>
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1]);
      continue;
    }

    flushBullets();
    if (line.trim() === "") {
      nodes.push(<div key={key++} className="h-2" />);
    } else {
      nodes.push(
        <p key={key++} className="leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  }
  flushBullets();
  return <>{nodes}</>;
}
