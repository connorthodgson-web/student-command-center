"use client";

import { useEffect, useMemo, useState } from "react";
import type { MessagingEndpoint } from "../types";

type VerificationStartResponse = {
  endpoint: MessagingEndpoint;
  simulated: boolean;
  simulatedCode?: string;
};

function formatPhoneDisplay(value: string) {
  if (!value.startsWith("+1") || value.length !== 12) return value;
  const digits = value.slice(2);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function endpointStatusLabel(endpoint: MessagingEndpoint) {
  switch (endpoint.verificationStatus) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending verification";
    case "failed":
      return "Verification needed";
    default:
      return "Not started";
  }
}

function endpointStatusClasses(endpoint: MessagingEndpoint) {
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

export function MessagingSettingsCard() {
  const [endpoints, setEndpoints] = useState<MessagingEndpoint[]>([]);
  const [phoneNumber, setPhoneNumber] = useState("");
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
    try {
      const response = await fetch("/api/messaging/endpoints", { cache: "no-store" });
      const json = (await response.json()) as { data?: MessagingEndpoint[]; error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load messaging endpoints.");
      }
      setEndpoints(json.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load messaging endpoints.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEndpoints();
  }, []);

  const createEndpoint = async () => {
    if (!phoneNumber.trim()) {
      setError("Enter a phone number first.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    setSimulatedCode(null);

    try {
      const response = await fetch("/api/messaging/endpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: {
            channelType: "sms",
            providerKey: "twilio",
            address: phoneNumber,
            label: "Student mobile",
          },
        }),
      });
      const json = (await response.json()) as { data?: MessagingEndpoint; error?: string };
      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to save phone number.");
      }

      setPhoneNumber("");
      setSuccess("Phone number saved. Send a verification code to finish setup.");
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
        setSuccess("Verification is running in simulated mode because live SMS sending is not fully configured.");
      } else {
        setSuccess("Verification code sent by SMS.");
      }

      await loadEndpoints();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to send verification code.");
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
      setError(preferenceError instanceof Error ? preferenceError.message : "Failed to update preferred endpoint.");
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
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "Failed to send test message.");
      }
      setSuccess("Test message sent.");
      await loadEndpoints();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "Failed to send test message.");
    } finally {
      setBusyEndpointId(null);
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">Text your assistant</h2>
        <p className="mt-1 text-sm text-muted">
          Add your phone number, verify it, and choose which number your assistant should use for SMS.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-background p-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Phone number</span>
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
            onClick={() => void createEndpoint()}
            disabled={saving}
            className="rounded-full bg-accent-green-foreground px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save phone number"}
          </button>
          <p className="text-xs text-muted">
            US-style 10-digit numbers are okay here. They&apos;ll be normalized before saving.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading messaging setup...</p>
      ) : smsEndpoints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-5">
          <p className="text-sm text-muted">
            No texting number added yet. Add one above to start SMS setup.
          </p>
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
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${endpointStatusClasses(endpoint)}`}
                      >
                        {endpointStatusLabel(endpoint)}
                      </span>
                      {endpoint.isPreferred && (
                        <span className="rounded-full border border-accent-blue-foreground/20 bg-accent-blue/10 px-2.5 py-0.5 text-[11px] font-medium text-accent-blue-foreground">
                          Preferred
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {isVerified
                        ? "Ready for texting and future reminder delivery."
                        : "This number needs verification before texting can be activated."}
                    </p>
                  </div>
                  {isVerified && !endpoint.isPreferred && (
                    <button
                      type="button"
                      onClick={() => void setPreferred(endpoint.id)}
                      disabled={isBusy}
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
                    >
                      Use for SMS
                    </button>
                  )}
                </div>

                {!isVerified && (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void startVerification(endpoint.id)}
                        disabled={isBusy}
                        className="rounded-full bg-sidebar-accent px-4 py-2 text-sm font-medium text-[#0f2117] transition hover:opacity-90 disabled:opacity-50"
                      >
                        {isBusy ? "Working..." : endpoint.verificationStatus === "pending" ? "Resend code" : "Send code"}
                      </button>
                      <p className="text-xs text-muted">
                        Codes expire after 10 minutes and SMS stays inactive until verification is complete.
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
                )}

                {isVerified && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void sendTestMessage(endpoint.id)}
                      disabled={isBusy}
                      className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
                    >
                      {isBusy ? "Sending..." : "Send test message"}
                    </button>
                    <p className="text-xs text-muted">
                      Sends a short assistant test text through the real outbound messaging path.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {simulatedCode && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
          <p className="text-sm text-amber-700">
            Simulated verification code: <span className="font-semibold">{simulatedCode}</span>
          </p>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-accent-green-foreground/20 bg-accent-green/10 px-4 py-3 text-sm text-accent-green-foreground">
          {success}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-accent-rose/20 bg-accent-rose/10 px-4 py-3 text-sm text-accent-rose-foreground">
          {error}
        </div>
      )}
    </section>
  );
}
