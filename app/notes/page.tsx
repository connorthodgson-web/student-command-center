"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { SectionHeader } from "../../components/SectionHeader";
import { useNotes } from "../../lib/stores/noteStore";
import type { StudentNote } from "../../types";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NoteCard({
  note,
  onDelete,
  onUpdate,
}: {
  note: StudentNote;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setDraft(note.content);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === note.content) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onUpdate(note.id, trimmed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  function cancelEdit() {
    setDraft(note.content);
    setEditing(false);
  }

  return (
    <div className="group relative rounded-xl border border-border bg-card px-4 py-3.5 transition-shadow hover:shadow-sm">
      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-sidebar-accent/50 focus:outline-none focus:ring-1 focus:ring-sidebar-accent/30"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => void saveEdit()}
              disabled={saving || !draft.trim()}
              className="rounded-lg bg-sidebar-accent/10 px-3 py-1.5 text-xs font-medium text-sidebar-accent transition hover:bg-sidebar-accent/20 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-foreground">{note.content}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted">
              {formatRelativeTime(note.updatedAt)}
            </span>
            {/* Action buttons — hidden until hover (always visible on touch) */}
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 md:opacity-0 max-md:opacity-100">
              <button
                onClick={startEdit}
                className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground"
                aria-label="Edit note"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={() => onDelete(note.id)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-accent-rose/10 hover:text-accent-rose-foreground"
                aria-label="Delete note"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function NotesPage() {
  const { notes, loading, addNote, updateNote, deleteNote } = useNotes();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await addNote({ content: trimmed });
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(noteId: string, content: string) {
    await updateNote(noteId, { content });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-6 py-10 animate-page-enter">
      <SectionHeader
        title="Memory"
        description="Little things your assistant remembers — so you don't have to."
        action={
          <Link
            href={`/chat?q=${encodeURIComponent("What notes do you have for me?")}`}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition hover:border-sidebar-accent/40 hover:bg-sidebar-accent/5 hover:text-foreground"
          >
            <span className="text-[10px] text-sidebar-accent">✦</span>
            Ask assistant
          </Link>
        }
      />

      {/* Quick add */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold text-foreground">Remember something</h2>
        <p className="mt-1 text-sm text-muted">
          Type anything — your assistant will keep it. No special format needed.
        </p>
        <div className="mt-4 space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleAdd();
            }}
            placeholder={`Remember I have office hours on Thursdays at 3pm…`}
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-sidebar-accent/50 focus:outline-none focus:ring-1 focus:ring-sidebar-accent/30 transition"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted/60">
              Or just tell your assistant: &ldquo;Remember that…&rdquo;
            </span>
            <button
              onClick={() => void handleAdd()}
              disabled={saving || !draft.trim()}
              className="rounded-xl bg-sidebar-accent/15 px-4 py-2 text-sm font-medium text-sidebar-accent transition hover:bg-sidebar-accent/25 disabled:pointer-events-none disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </section>

      {/* Notes list */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">What I Remember</h2>
            {notes.length > 0 && (
              <p className="mt-0.5 text-xs text-muted">
                {notes.length} {notes.length === 1 ? "note" : "notes"} saved
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-border border-t-sidebar-accent" />
              <p className="text-sm text-muted">Loading…</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                <svg className="h-5 w-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.6}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-foreground">Nothing remembered yet.</p>
              <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-muted">
                Try telling your assistant &ldquo;Remember I have bio office hours on Fridays&rdquo; — or add a quick note above. This is for small things, not formal class notes.
              </p>
              <Link
                href="/chat"
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted transition hover:border-sidebar-accent/40 hover:text-foreground"
              >
                <span className="text-[10px] text-sidebar-accent">✦</span>
                Open Assistant
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onDelete={deleteNote}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
