import { notFound } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { buildMessagingReadiness } from "../../../lib/messaging-readiness";
import { mapDbMessagingEndpoint, type DbMessagingEndpointRow } from "../../../lib/messaging-data";

type CountResult = {
  label: string;
  table: string;
  count: number | null;
  error?: string;
};

async function getTableCount(table: string, userId: string): Promise<CountResult> {
  const supabase = await createClient();
  if (!supabase) {
    return { label: table, table, count: null, error: "Supabase is not configured." };
  }

  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  return {
    label: table,
    table,
    count: count ?? 0,
    error: error?.message,
  };
}

export default async function LaunchReadinessPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const supabase = await createClient();

  if (!supabase) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Supabase is not configured in this environment, so launch-readiness checks cannot run.
        </div>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-2xl border border-border bg-card px-5 py-4 text-sm text-muted">
          Sign in first to view your launch-readiness data snapshot.
        </div>
      </main>
    );
  }

  const tables = [
    "classes",
    "tasks",
    "reminder_preferences",
    "reminder_delivery_runs",
    "class_materials",
    "assistant_sessions",
    "assistant_session_messages",
    "assistant_attachments",
    "automations",
    "planning_items",
    "messaging_endpoints",
    "messaging_conversations",
    "messaging_messages",
  ];

  const counts = await Promise.all(tables.map((table) => getTableCount(table, user.id)));

  const [
    { data: latestTask },
    { data: latestSession },
    { data: reminderPreferences },
    { data: endpoints },
    { data: latestAttachment },
    { data: latestReminderRun },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, status, due_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("assistant_sessions")
      .select("id, channel, updated_at, last_message_at, tutoring_mode")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reminder_preferences")
      .select("delivery_channel, daily_summary_enabled, tonight_summary_enabled, due_soon_reminders_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("messaging_endpoints")
      .select("address, verification_status, is_active, is_preferred")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("assistant_attachments")
      .select("title, processing_status, analysis_status, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("reminder_delivery_runs")
      .select("reminder_kind, delivery_channel, delivery_status, reason, attempted_at")
      .eq("user_id", user.id)
      .order("attempted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const messagingReadiness = buildMessagingReadiness(
    ((endpoints ?? []) as DbMessagingEndpointRow[]).map(mapDbMessagingEndpoint),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Dev
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Launch Readiness Snapshot
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          This page is a lightweight signed-in snapshot of the launch-critical persistence
          surfaces. It is meant for manual verification, not as an end-user screen.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((result) => (
          <div key={result.table} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{result.table}</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {result.error ? "Error" : result.count}
            </p>
            <p className="mt-1 text-xs text-muted">
              {result.error ?? "Rows visible to the signed-in user"}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Latest task</h2>
          {latestTask ? (
            <dl className="mt-3 space-y-2 text-sm text-muted">
              <div>
                <dt className="font-medium text-foreground">{latestTask.title}</dt>
                <dd>Status: {latestTask.status}</dd>
              </div>
              <div>Due: {latestTask.due_at ?? "not set"}</div>
              <div>Updated: {latestTask.updated_at}</div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No task rows yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Latest assistant session</h2>
          {latestSession ? (
            <dl className="mt-3 space-y-2 text-sm text-muted">
              <div>Channel: {latestSession.channel}</div>
              <div>Tutoring mode: {latestSession.tutoring_mode ?? "n/a"}</div>
              <div>Last message: {latestSession.last_message_at ?? "none yet"}</div>
              <div>Updated: {latestSession.updated_at}</div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No assistant sessions yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Reminder delivery</h2>
          {reminderPreferences ? (
            <dl className="mt-3 space-y-2 text-sm text-muted">
              <div>Channel: {reminderPreferences.delivery_channel}</div>
              <div>Daily summary: {String(reminderPreferences.daily_summary_enabled)}</div>
              <div>Tonight summary: {String(reminderPreferences.tonight_summary_enabled)}</div>
              <div>
                Due soon reminders: {String(reminderPreferences.due_soon_reminders_enabled)}
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No reminder preference row yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Messaging endpoints</h2>
          <p className="mt-2 text-sm text-muted">
            {messagingReadiness.statusLabel}: {messagingReadiness.statusDetail}
          </p>
          {endpoints && endpoints.length > 0 ? (
            <div className="mt-3 space-y-3 text-sm text-muted">
              {endpoints.map((endpoint) => (
                <div key={endpoint.address} className="rounded-xl border border-border bg-background px-3 py-2">
                  <div className="font-medium text-foreground">{endpoint.address}</div>
                  <div>
                    {endpoint.verification_status} / active={String(endpoint.is_active)} /
                    preferred={String(endpoint.is_preferred)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No messaging endpoints yet.</p>
          )}
          {messagingReadiness.issues.length ? (
            <div className="mt-3 space-y-1 rounded-xl border border-accent-rose/20 bg-accent-rose/10 px-3 py-3 text-sm text-accent-rose-foreground">
              {messagingReadiness.issues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Latest reminder run</h2>
          {latestReminderRun ? (
            <dl className="mt-3 space-y-2 text-sm text-muted">
              <div>Kind: {latestReminderRun.reminder_kind}</div>
              <div>Channel: {latestReminderRun.delivery_channel}</div>
              <div>Status: {latestReminderRun.delivery_status}</div>
              <div>Attempted: {latestReminderRun.attempted_at}</div>
              <div>Reason: {latestReminderRun.reason ?? "n/a"}</div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No reminder delivery runs yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Latest tutoring or file grounding artifact</h2>
          {latestAttachment ? (
            <dl className="mt-3 space-y-2 text-sm text-muted">
              <div className="font-medium text-foreground">{latestAttachment.title}</div>
              <div>Processing: {latestAttachment.processing_status}</div>
              <div>Analysis: {latestAttachment.analysis_status}</div>
              <div>Updated: {latestAttachment.updated_at}</div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted">No assistant attachments yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
