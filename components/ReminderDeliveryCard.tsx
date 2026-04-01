"use client";

import { useEffect, useMemo, useState } from "react";
import { useReminderStore } from "../lib/reminder-store";
import type { MessagingEndpoint, MessagingReadiness } from "../types";

type EndpointResponse = {
  data?: MessagingEndpoint[];
  readiness?: MessagingReadiness;
  error?: string;
};

type ReminderDeliveryRun = {
  id: string;
  reminderKind: "daily_summary" | "tonight_summary" | "due_soon";
  deliveryChannel: "in_app" | "sms";
  deliveryStatus: "processing" | "sent" | "skipped" | "failed";
  deliveryTarget?: string;
  reason?: string;
  attemptedAt: string;
};

type ReminderRunResponse = {
  data?: ReminderDeliveryRun[];
  error?: string;
};

function formatAttemptTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatReminderKind(kind: ReminderDeliveryRun["reminderKind"]) {
  switch (kind) {
    case "daily_summary":
      return "Daily summary";
    case "tonight_summary":
      return "Tonight summary";
    case "due_soon":
      return "Due soon";
    default:
      return kind;
  }
}

export function ReminderDeliveryCard() {
  const { preferences, updatePreferences } = useReminderStore();
  const [endpoints, setEndpoints] = useState<MessagingEndpoint[]>([]);
  const [readiness, setReadiness] = useState<MessagingReadiness | null>(null);
  const [recentRuns, setRecentRuns] = useState<ReminderDeliveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifiedSmsEndpoint = useMemo(
    () =>
      endpoints.find(
        (endpoint) =>
          endpoint.channelType === "sms" &&
          endpoint.verificationStatus === "verified" &&
          endpoint.isActive &&
          endpoint.isPreferred,
      ) ??
      endpoints.find(
        (endpoint) =>
          endpoint.channelType === "sms" &&
          endpoint.verificationStatus === "verified" &&
          endpoint.isActive,
      ) ??
      null,
    [endpoints],
  );

  useEffect(() => {
    let cancelled = false;

    const loadMessagingState = async () => {
      setLoading(true);
      setError(null);

      try {
        const [endpointResponse, runsResponse] = await Promise.all([
          fetch("/api/messaging/endpoints", { cache: "no-store" }),
          fetch("/api/reminder-runner?limit=5", { cache: "no-store" }),
        ]);

        const endpointJson = (await endpointResponse.json()) as EndpointResponse;
        if (!endpointResponse.ok) {
          throw new Error(endpointJson.error ?? "Failed to load messaging endpoints.");
        }

        const runsJson = (await runsResponse.json()) as ReminderRunResponse;
        if (!runsResponse.ok) {
          throw new Error(runsJson.error ?? "Failed to load reminder delivery history.");
        }

        if (!cancelled) {
          setEndpoints(endpointJson.data ?? []);
          setReadiness(endpointJson.readiness ?? null);
          setRecentRuns(runsJson.data ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load reminder delivery settings.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMessagingState();
    return () => {
      cancelled = true;
    };
  }, []);

  const setDeliveryChannel = async (deliveryChannel: "in_app" | "sms") => {
    setSaving(true);
    setError(null);
    try {
      await updatePreferences({ deliveryChannel });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save reminder delivery.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface/50 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">Reminder delivery</p>
      <p className="mt-2 text-sm text-muted">
        Choose where your assistant sends reminders and summaries.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void setDeliveryChannel("in_app")}
          disabled={saving}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            preferences.deliveryChannel === "in_app"
              ? "border-accent-green-foreground bg-accent-green/10"
              : "border-border bg-card hover:bg-surface"
          } disabled:opacity-60`}
        >
          <p className="text-sm font-semibold text-foreground">In-app</p>
          <p className="mt-1 text-xs text-muted">Works right now without SMS setup.</p>
        </button>

        <button
          type="button"
          onClick={() => void setDeliveryChannel("sms")}
          disabled={saving || !verifiedSmsEndpoint || !readiness?.deliveryAvailable}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            preferences.deliveryChannel === "sms"
              ? "border-accent-green-foreground bg-accent-green/10"
              : "border-border bg-card hover:bg-surface"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <p className="text-sm font-semibold text-foreground">SMS</p>
          <p className="mt-1 text-xs text-muted">
            {verifiedSmsEndpoint && readiness?.deliveryAvailable
              ? `Ready to use ${verifiedSmsEndpoint.address} for future reminder delivery.`
              : verifiedSmsEndpoint
                ? "A number is verified, but live SMS delivery is still unavailable."
                : "Add and verify a texting number first."}
          </p>
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
        {loading
          ? "Checking messaging availability..."
          : verifiedSmsEndpoint && readiness?.deliveryAvailable
            ? `Messaging is available. Future reminders can target ${verifiedSmsEndpoint.address}.`
            : verifiedSmsEndpoint
              ? "Your number is verified, but outbound texting is not active yet. In-app reminders work now."
              : "No verified SMS number yet. In-app reminders work now. Add a number in Messaging to enable SMS."}
      </div>

      {recentRuns.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Recent delivery activity
          </p>
          <div className="mt-3 space-y-3">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">
                    {formatReminderKind(run.reminderKind)} to{" "}
                    {run.deliveryChannel === "sms" ? "SMS" : "in-app"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatAttemptTime(run.attemptedAt)}
                    {run.deliveryTarget ? ` · ${run.deliveryTarget}` : ""}
                    {run.reason ? ` · ${run.reason}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    run.deliveryStatus === "sent"
                      ? "border-accent-green-foreground/20 bg-accent-green/10 text-accent-green-foreground"
                      : run.deliveryStatus === "failed"
                        ? "border-accent-rose/20 bg-accent-rose/10 text-accent-rose-foreground"
                        : "border-border bg-surface text-muted"
                  }`}
                >
                  {run.deliveryStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {readiness?.issues.length ? (
        <div className="mt-4 rounded-xl border border-accent-rose/20 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose-foreground">
          {readiness.issues.join(" ")}
        </div>
      ) : null}

      {error && (
        <p className="mt-3 rounded-xl border border-accent-rose/20 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose-foreground">
          {error}
        </p>
      )}
    </section>
  );
}
