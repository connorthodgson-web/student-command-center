"use client";

import { useEffect, useMemo, useState } from "react";
import { useReminderStore } from "../lib/reminder-store";
import type { MessagingEndpoint } from "../types";

export function ReminderDeliveryCard() {
  const { preferences, updatePreferences } = useReminderStore();
  const [endpoints, setEndpoints] = useState<MessagingEndpoint[]>([]);
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

    const loadEndpoints = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/messaging/endpoints", { cache: "no-store" });
        const json = (await response.json()) as { data?: MessagingEndpoint[]; error?: string };
        if (!response.ok) {
          throw new Error(json.error ?? "Failed to load messaging endpoints.");
        }
        if (!cancelled) {
          setEndpoints(json.data ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load messaging endpoints.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadEndpoints();
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
        Choose where future reminders and summaries should go once delivery runs through the messaging layer.
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
          disabled={saving || !verifiedSmsEndpoint}
          className={`rounded-2xl border px-4 py-4 text-left transition ${
            preferences.deliveryChannel === "sms"
              ? "border-accent-green-foreground bg-accent-green/10"
              : "border-border bg-card hover:bg-surface"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <p className="text-sm font-semibold text-foreground">SMS</p>
          <p className="mt-1 text-xs text-muted">
            {verifiedSmsEndpoint
              ? `Ready to use ${verifiedSmsEndpoint.address} for future reminder delivery.`
              : "Add and verify a texting number first."}
          </p>
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted">
        {loading
          ? "Checking messaging availability..."
          : verifiedSmsEndpoint
            ? `Messaging is available. Future reminders can target ${verifiedSmsEndpoint.address}.`
            : "Messaging is not ready yet because there is no verified SMS endpoint."}
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-accent-rose/20 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose-foreground">
          {error}
        </p>
      )}
    </section>
  );
}
