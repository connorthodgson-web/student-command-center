"use client";

import { useEffect, useMemo, useState } from "react";
import type { MessagingEndpoint, MessagingMessage, MessagingReadiness } from "../types";

type VerificationStartResponse = {
  endpoint: MessagingEndpoint;
  simulated: boolean;
  simulatedCode?: string;
};

type EndpointResponse = {
  data?: MessagingEndpoint[];
  readiness?: MessagingReadiness;
  error?: string;
};

function formatPhoneDisplay(value: string) {
  if (!value.startsWith("+1") || value.length !== 12) return value;
  const digits = value.slice(2);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatTimestamp(value?: string) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

function formatStatusLabel(status: MessagingReadiness["launchStatus"]) {
  switch (status) {
    case "verified":
      return "Verified";
    case "delivery_unavailable":
      return "Delivery unavailable";
    case "unverified":
      return "Unverified";
    default:
      return "Missing";
  }
}

function readinessBadgeClasses(status: MessagingReadiness["launchStatus"]) {
  switch (status) {
    case "verified":
      return "border-accent-green-foreground/20 bg-accent-green/10 text-accent-green-foreground";
    case "delivery_unavailable":
      return "border-accent-rose/20 bg-accent-rose/10 text-accent-rose-foreground";
    case "unverified":
      return "border-amber-400/20 bg-amber-400/10 text-amber-700";
    default:
      return "border-border bg-surface text-muted";
  }
}

function endpointVerificationLabel(endpoint: MessagingEndpoint) {
  switch (endpoint.verificationStatus) {
    case "verified":
      return "Verified";
    case "pending":
      return "Code sent";
    case "failed":
      return "Verification failed";
    default:
      return "Saved, not verified";
  }
}

function endpointVerificationClasses(endpoint: MessagingEndpoint) {
  switch (endpoint.verificationStatus) {
    case "verified":
      return "border-accent-green-foreground/20 bg-accent-green/10 text-accent-green-foreground";
    case "pending":
      return "border-amber-400/20 bg-amber-400/10 text-amber-700";
    case "failed":
      return "border-accent-rose/20 bg-accent-rose/10 text-accent-rose-foreground";
    default:
      return "border-border bg-surface text-muted";
  }
}

function endpointHelpText(endpoint: MessagingEndpoint, readiness: MessagingReadiness | null) {
  if (endpoint.verificationStatus !== "verified") {
    if (readiness && !readiness.verificationSupported) {
      return "This number is saved, but verification is not available yet for this deployment.";
    }

    if (endpoint.verificationStatus === "pending") {
      return "A code was sent or simulated. Enter it below to finish setup.";
    }

    if (endpoint.verificationStatus === "failed") {
      return "Verification did not complete. Send a new code to keep going.";
    }

    return "This number is saved, but texting stays off until you send and confirm a verification code.";
  }

  if (readiness?.deliveryAvailable) {
    return readiness.deliveryStatusTrackingAvailable
      ? "Verified and ready for real outbound texts and SMS reminder delivery."
      : "Verified and able to send live texts, but delivery receipts are not fully wired yet for this deployment.";
  }

  return "Your number is verified, but outbound texting is not active for this deployment yet.";
}

export function MessagingSettingsCard() {
  const [endpoints, setEndpoints] = useState<MessagingEndpoint[]>([]);
  const [readiness, setReadiness] = useState<MessagingReadiness | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyEndpointId, setBusyEndpointId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [simulatedCode, setSimulatedCode] = useState<string | null>(null);

  const smsEndpoints = useMemo(
    () => endpoints.filter((endpoint) => endpoint.channelType === "sms"),
    [endpoints],
  );

  const loadEndpoints = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/messaging/endpoints", { cache: "no-store" });
      const json = (await response.json()) as EndpointResponse;
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load messaging endpoints.");
      }
      setEndpoints(json.data ?? []);
      setReadiness(json.readiness ?? null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load messaging endpoints.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEndpoints();
  }, []);

  const saveEndpoint = async () => {
    if (!phoneNumber.trim()) {
      setError("Enter a phone number first.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setSimulatedCode(null);

    try {
      const response = await fetch(
        editingEndpointId
          ? `/api/messaging/endpoints/${editingEndpointId}`
          : "/api/messaging/endpoints",
        {
          method: editingEndpointId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingEndpointId
              ? {
                  address: phoneNumber,
                  label: "Student mobile",
                }
              : {
                  endpoint: {
                    channelType: "sms",
                    providerKey: "twilio",
                    address: phoneNumber,
                    label: "Student mobile",
                  },
                },
          ),
        },
      );
      const json = (await response.json()) as { data?: MessagingEndpoint; error?: string };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to save phone number.");
      }

      setPhoneNumber("");
      setEditingEndpointId(null);
      setSuccess(
        editingEndpointId
          ? "Phone number updated. Re-verify it before turning SMS back on."
          : "Phone number saved. Send a verification code to finish setup.",
      );
      await loadEndpoints();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save phone number.");
    } finally {
      setSaving(false);
    }
  };

  const startVerification = async (endpointId: string) => {
    setBusyEndpointId(endpointId);
    setError(null);
    setSuccess(null);
    setSimulatedCode(null);

    try {
      const response = await fetch(`/api/messaging/endpoints/${endpointId}/verify/start`, {
        method: "POST",
      });
      const json = (await response.json()) as { data?: VerificationStartResponse; error?: string };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to send verification code.");
      }

      if (json.data.simulated && json.data.simulatedCode) {
        setSimulatedCode(json.data.simulatedCode);
        setSuccess("Verification is in test mode. Use the code shown below to complete setup.");
      } else {
        setSuccess("Verification code sent by SMS.");
      }

      await loadEndpoints();
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Failed to send verification code.",
      );
    } finally {
      setBusyEndpointId(null);
    }
  };

  const confirmVerification = async (endpointId: string) => {
    const code = verificationCode[endpointId]?.trim();
    if (!code) {
      setError("Enter the verification code first.");
      return;
    }

    setBusyEndpointId(endpointId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/messaging/endpoints/${endpointId}/verify/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to verify code.");
      }

      setVerificationCode((current) => ({ ...current, [endpointId]: "" }));
      setSimulatedCode(null);
      setSuccess("Phone number verified. Your assistant can now text this number.");
      await loadEndpoints();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Failed to verify code.");
    } finally {
      setBusyEndpointId(null);
    }
  };

  const setPreferred = async (endpointId: string) => {
    setBusyEndpointId(endpointId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/messaging/endpoints/${endpointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPreferred: true }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to update preferred endpoint.");
      }
      setSuccess("Preferred texting number updated.");
      await loadEndpoints();
    } catch (preferenceError) {
      setError(
        preferenceError instanceof Error
          ? preferenceError.message
          : "Failed to update preferred endpoint.",
      );
    } finally {
      setBusyEndpointId(null);
    }
  };

  const sendTestMessage = async (endpointId: string) => {
    setBusyEndpointId(endpointId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/messaging/endpoints/${endpointId}/test-message`, {
        method: "POST",
      });
      const json = (await response.json()) as { data?: MessagingMessage; error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? json.data?.errorMessage ?? "Failed to send test message.");
      }
      if (json.data?.deliveryStatus === "failed") {
        throw new Error(json.data.errorMessage ?? "Test message could not be delivered.");
      }
      setSuccess(
        json.data?.deliveryStatus === "queued"
          ? "Test message queued. It should arrive shortly."
          : "Test message sent.",
      );
      await loadEndpoints();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to send test message.");
    } finally {
      setBusyEndpointId(null);
    }
  };

  const startEdit = (endpoint: MessagingEndpoint) => {
    setPhoneNumber(endpoint.address);
    setEditingEndpointId(endpoint.id);
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setPhoneNumber("");
    setEditingEndpointId(null);
  };

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">Text reminders</h2>
        <p className="mt-1 text-sm text-muted">
          Add and verify your phone number to receive SMS reminders from your assistant.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">SMS status</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                  readiness ? readinessBadgeClasses(readiness.launchStatus) : "border-border bg-surface text-muted"
                }`}
              >
                {readiness ? formatStatusLabel(readiness.launchStatus) : "Checking"}
              </span>
              {readiness?.recommendedAddress ? (
                <span className="text-xs text-muted">
                  {formatPhoneDisplay(readiness.recommendedAddress)}
                </span>
              ) : null}
              {readiness?.deliveryStatusTrackingAvailable ? (
                <span className="rounded-full border border-accent-blue-foreground/20 bg-accent-blue/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-blue-foreground">
                  Delivery receipts on
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-muted">
              {readiness?.statusDetail ?? "Checking whether SMS setup is ready for launch testing..."}
            </p>
          </div>
        </div>

        {readiness?.issues.length ? (
          <div className="mt-4 rounded-xl border border-accent-rose/20 bg-accent-rose/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-rose-foreground">
              Not ready for delivery
            </p>
            <ul className="mt-2 space-y-1 text-sm text-accent-rose-foreground">
              {readiness.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">
            {editingEndpointId ? "Edit phone number" : "Phone number"}
          </span>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="e.g. (555) 123-4567"
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
          />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void saveEndpoint()}
            disabled={saving}
            className="rounded-full bg-accent-green-foreground px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : editingEndpointId ? "Save changes" : "Save phone number"}
          </button>
          {editingEndpointId ? (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
            >
              Cancel
            </button>
          ) : null}
          <p className="text-xs text-muted">
            US-style 10-digit numbers are okay here. Saving a changed number resets verification so you can test honestly.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading messaging setup...</p>
      ) : smsEndpoints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-5">
          <p className="text-sm text-muted">No texting number added yet. Add one above to start SMS setup.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {smsEndpoints.map((endpoint) => {
            const isBusy = busyEndpointId === endpoint.id;
            const isVerified = endpoint.verificationStatus === "verified";

            return (
              <div key={endpoint.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {formatPhoneDisplay(endpoint.address)}
                      </p>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${endpointVerificationClasses(endpoint)}`}
                      >
                        {endpointVerificationLabel(endpoint)}
                      </span>
                      {endpoint.isPreferred ? (
                        <span className="rounded-full border border-accent-blue-foreground/20 bg-accent-blue/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-blue-foreground">
                          Preferred
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted">{endpointHelpText(endpoint, readiness)}</p>
                    {endpoint.lastVerificationSentAt || endpoint.lastSeenAt ? (
                      <p className="mt-1 text-[11px] text-muted">
                        {endpoint.lastVerificationSentAt
                          ? `Last code sent ${formatTimestamp(endpoint.lastVerificationSentAt)}. `
                          : ""}
                        {endpoint.lastSeenAt
                          ? `Last inbound activity ${formatTimestamp(endpoint.lastSeenAt)}.`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(endpoint)}
                      disabled={isBusy || saving}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
                    >
                      Edit
                    </button>
                    {isVerified && !endpoint.isPreferred ? (
                      <button
                        type="button"
                        onClick={() => void setPreferred(endpoint.id)}
                        disabled={isBusy}
                        className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
                      >
                        Use for SMS
                      </button>
                    ) : null}
                  </div>
                </div>

                {!isVerified ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void startVerification(endpoint.id)}
                        disabled={isBusy || !readiness?.verificationSupported}
                        className="rounded-full bg-sidebar-accent px-4 py-2 text-sm font-medium text-[#0f2117] transition hover:opacity-90 disabled:opacity-50"
                      >
                        {isBusy
                          ? "Working..."
                          : endpoint.verificationStatus === "pending"
                            ? "Resend code"
                            : "Send code"}
                      </button>
                      <p className="text-xs text-muted">
                        {readiness?.verificationSupported
                          ? "Codes expire after 10 minutes. SMS stays off until you verify."
                          : "Verification is not available for this deployment yet."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={verificationCode[endpoint.id] ?? ""}
                        onChange={(event) =>
                          setVerificationCode((current) => ({
                            ...current,
                            [endpoint.id]: event.target.value,
                          }))
                        }
                        placeholder="Enter 6-digit code"
                        className="w-44 rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
                      />
                      <button
                        type="button"
                        onClick={() => void confirmVerification(endpoint.id)}
                        disabled={isBusy}
                        className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
                      >
                        Confirm code
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void sendTestMessage(endpoint.id)}
                      disabled={isBusy || !readiness?.deliveryAvailable}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
                    >
                      {isBusy ? "Sending..." : "Send test message"}
                    </button>
                    <p className="text-xs text-muted">
                      {readiness?.deliveryAvailable
                        ? readiness.deliveryStatusTrackingAvailable
                          ? "Sends a short test message and lets the app track later delivery receipts."
                          : "Sends a short test message, but this deployment is not yet wired for final delivery receipts."
                        : "Live delivery is not active for this deployment yet."}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {simulatedCode ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
          <p className="text-sm text-amber-700">
            Test mode code:{" "}
            <span className="font-mono font-semibold tracking-widest">{simulatedCode}</span>
          </p>
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-accent-green-foreground/20 bg-accent-green/10 px-4 py-3 text-sm text-accent-green-foreground">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-accent-rose/20 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose-foreground">
          {error}
        </div>
      ) : null}
    </section>
  );
}
