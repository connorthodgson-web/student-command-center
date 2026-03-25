"use client";

// Developer tool — not a user-facing page.
// Runs the natural-language parser against canonical inputs on mount so you can
// verify that due dates, titles, and types are being extracted correctly.
// TODO: Remove the NavBar link before any public release of this app.

import { useEffect, useState } from "react";
import { formatDueDate } from "../../../lib/datetime";
import type { StudentTask } from "../../../types";

// These are the canonical inputs used to evaluate parser quality.
// Add or edit them here as real student phrasing patterns are discovered.
const CANONICAL_INPUTS = [
  "I have a Great Gatsby essay due March 11 at 11:59 PM.",
  "Math homework due tomorrow.",
  "Bio test next Friday.",
  "History reading due Monday before class.",
  "Spanish quiz Thursday at 9 AM.",
  "Lab write-up due this Sunday night.",
  "Physics problem set due in 3 days.",
  "Remind me to study chemistry tonight.",
  "English paper due next Wednesday at midnight.",
  "Calc test end of the week.",
];

type BatchResult = {
  input: string;
  result: Partial<StudentTask> | null;
  error: string | null;
};

export default function ParseTestPage() {
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [batchLoading, setBatchLoading] = useState(true);

  const [liveInput, setLiveInput] = useState("");
  const [liveResult, setLiveResult] = useState<Partial<StudentTask> | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Run all canonical inputs through the parser in parallel on mount.
  // Uses the /api/ai/parse-task route — same path as TaskCapture — so this
  // tests the real end-to-end pipeline, not just the lib function in isolation.
  useEffect(() => {
    const runBatch = async () => {
      const results = await Promise.all(
        CANONICAL_INPUTS.map(async (input): Promise<BatchResult> => {
          try {
            const res = await fetch("/api/ai/parse-task", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ input }),
            });
            const json = (await res.json()) as {
              data?: Partial<StudentTask>;
              error?: string;
            };
            return { input, result: json.data ?? null, error: json.error ?? null };
          } catch (err) {
            return {
              input,
              result: null,
              error: err instanceof Error ? err.message : "Network error",
            };
          }
        })
      );
      setBatchResults(results);
      setBatchLoading(false);
    };

    runBatch();
  }, []);

  const handleLiveParse = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = liveInput.trim();
    if (!trimmed) return;

    setLiveLoading(true);
    setLiveResult(null);
    setLiveError(null);

    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      const json = (await res.json()) as {
        data?: Partial<StudentTask>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      setLiveResult(json.data ?? null);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLiveLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">

      {/* Dev-only warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        This page is for development testing only. It calls the real parser on every
        load. Remove from the NavBar before any public release.
      </div>

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Parse Test — Developer Tool
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Runs{" "}
          <code className="rounded bg-background px-1 font-mono text-xs">
            parseNaturalLanguageTask
          </code>{" "}
          against {CANONICAL_INPUTS.length} canonical student inputs. Check the{" "}
          <strong>Due</strong> column — amber cells mean no date was extracted.
          Check <strong>Raw dueAt</strong> to verify the exact ISO timestamp.
        </p>
      </div>

      {/* ── Section A: Batch results ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          Batch Test Results
        </h2>

        {batchLoading ? (
          <p className="text-sm text-slate-600">Running tests…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-background text-xs uppercase tracking-wide text-muted">
                  <th className="px-3 py-2 text-left">Input</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Raw dueAt</th>
                  <th className="px-3 py-2 text-left">Reminder</th>
                </tr>
              </thead>
              <tbody>
                {batchResults.map(({ input, result, error }) => {
                  const hasDue = !!result?.dueAt;
                  const truncatedInput =
                    input.length > 50 ? input.slice(0, 50) + "…" : input;

                  return (
                    <tr key={input} className="border-b border-border last:border-b-0">
                      {/* Input */}
                      <td className="px-3 py-2 text-slate-700">{truncatedInput}</td>

                      {/* Title */}
                      <td className="px-3 py-2 text-foreground">
                        {error ? (
                          <span className="text-red-600 text-xs">{error}</span>
                        ) : (
                          result?.title ?? "—"
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-3 py-2 capitalize text-foreground">
                        {result?.type ?? "—"}
                      </td>

                      {/* Due — amber when missing */}
                      <td
                        className={`px-3 py-2 ${
                          !hasDue && !error
                            ? "bg-amber-50 text-amber-700"
                            : "text-foreground"
                        }`}
                      >
                        {result ? formatDueDate(result.dueAt) : "—"}
                      </td>

                      {/* Raw dueAt */}
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-slate-500">
                          {result?.dueAt ?? "null"}
                        </span>
                      </td>

                      {/* Reminder */}
                      <td className="px-3 py-2 text-foreground">
                        {result?.reminderAt
                          ? formatDueDate(result.reminderAt)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Section B: Live input tester ─────────────────────────────────── */}
      <section>
        <h2 className="mb-1 text-lg font-semibold text-foreground">
          Live Input Tester
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Type any natural-language task description and press Parse to see what
          the parser extracts.
        </p>

        <form onSubmit={handleLiveParse} className="space-y-4">
          <textarea
            value={liveInput}
            onChange={(e) => setLiveInput(e.target.value)}
            placeholder="Type any task description and press Parse..."
            className="min-h-28 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="submit"
            disabled={liveLoading || !liveInput.trim()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {liveLoading ? "Parsing…" : "Parse"}
          </button>
        </form>

        {/* Error */}
        {liveError && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {liveError}
          </p>
        )}

        {/* Result */}
        {liveResult && (
          <div className="mt-5 rounded-2xl border border-border bg-card p-5">
            <p className="mb-3 text-sm font-semibold text-foreground">
              Parser output
            </p>
            <dl className="space-y-2 rounded-xl border border-border bg-background p-4 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-muted">Title</dt>
                <dd className="font-semibold text-foreground">
                  {liveResult.title ?? "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-muted">Type</dt>
                <dd className="capitalize text-foreground">
                  {liveResult.type ?? "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-muted">Due</dt>
                <dd
                  className={
                    liveResult.dueAt ? "text-foreground" : "text-amber-700"
                  }
                >
                  {formatDueDate(liveResult.dueAt)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-muted">Raw dueAt</dt>
                <dd className="font-mono text-xs text-slate-500">
                  {liveResult.dueAt ?? "null"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-muted">Reminder</dt>
                <dd className="text-foreground">
                  {liveResult.reminderAt
                    ? formatDueDate(liveResult.reminderAt)
                    : "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-medium text-muted">Status</dt>
                <dd className="capitalize text-foreground">
                  {liveResult.status ?? "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}
