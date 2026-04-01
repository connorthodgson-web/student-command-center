"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { getSupabaseConfig } from "../../../lib/supabase/env";

type Mode = "login" | "signup";

const supabaseReady = getSupabaseConfig() !== null;
const TEST_EMAIL = "test@student.dev";
const TEST_PASSWORD = "test1234";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  const router = useRouter();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. See the setup notice above.");
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setSuccess("Account created. Check your email to confirm, then log in.");
        switchMode("login");
      }
    }

    setLoading(false);
  }

  async function handleTestLogin() {
    setError(null);
    setSuccess(null);
    setTestLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured. See the setup notice above.");
      setTestLoading(false);
      return;
    }

    const initialSignIn = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (!initialSignIn.error) {
      router.push("/dashboard");
      router.refresh();
      setTestLoading(false);
      return;
    }

    if (!shouldAttemptProvision(initialSignIn.error.code)) {
      setError(getFriendlyTestLoginError(initialSignIn.error.message));
      setTestLoading(false);
      return;
    }

    const provisionResponse = await fetch("/api/auth/test-login", {
      method: "POST",
    });
    const provisionJson = (await provisionResponse.json()) as {
      error?: string;
      details?: string;
    };

    if (!provisionResponse.ok) {
      setError(provisionJson.error ?? "Test mode is unavailable right now.");
      setTestLoading(false);
      return;
    }

    const retrySignIn = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (retrySignIn.error) {
      setError(getFriendlyTestLoginError(retrySignIn.error.message));
      setTestLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
    setTestLoading(false);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background overflow-y-auto">
      <div className="bg-hero px-8 py-12">
        <div className="mx-auto max-w-sm">
          <div className="flex items-center gap-2.5">
            <span className="inline-block h-2 w-2 rounded-full bg-sidebar-accent" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
              Student Command Center
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-bold leading-snug text-white">
            {mode === "login" ? "Welcome back." : "Create your account."}
          </h1>
          <p className="mt-2 text-sm text-white/50">
            {mode === "login"
              ? "Sign in to access your assistant and schedule."
              : "Get started with your AI-powered academic assistant."}
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center px-8 py-8">
        <div className="w-full max-w-sm">
          {!supabaseReady && (
            <div className="mb-6 rounded-xl border border-accent-amber bg-accent-amber/40 px-4 py-3 text-sm text-accent-amber-foreground">
              <p className="font-semibold">Supabase not configured</p>
              <p className="mt-1 opacity-80">
                Add these two lines to <code className="font-mono">.env.local</code>, then restart the dev server:
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-accent-amber/50 px-3 py-2 text-xs leading-relaxed">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
              </pre>
              <p className="mt-2 text-xs opacity-70">
                Get these from your Supabase project {"->"} Settings {"->"} API.
              </p>
            </div>
          )}

          <div className="mb-6 flex rounded-xl border border-border bg-card p-1 shadow-sm">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-sidebar text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          {success && (
            <div className="mb-4 rounded-lg border border-accent-green bg-accent-green/30 px-4 py-3 text-sm text-accent-green-foreground">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-accent-rose bg-accent-rose/40 px-4 py-3 text-sm text-accent-rose-foreground">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition focus:border-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-accent/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 transition focus:border-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-accent/20"
              />
              {mode === "signup" && (
                <p className="mt-1.5 text-xs text-muted/60">Minimum 6 characters.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !supabaseReady}
              className="w-full rounded-xl bg-sidebar py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading
                ? mode === "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted/70">
            {mode === "login" ? "No account? " : "Already have one? "}
            <button
              type="button"
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="font-medium text-muted underline underline-offset-2 hover:text-foreground"
            >
              {mode === "login" ? "Sign up free" : "Log in"}
            </button>
          </p>

          {supabaseReady && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-2 text-center text-xs text-muted/50">Beta testing</p>
              <button
                type="button"
                onClick={() => void handleTestLogin()}
                disabled={testLoading || loading}
                className="w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-medium text-muted transition hover:bg-card hover:text-foreground disabled:opacity-50"
              >
                {testLoading ? "Signing in..." : "Sign in with test account"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function shouldAttemptProvision(errorCode?: string) {
  return errorCode === "invalid_credentials" || !errorCode;
}

function getFriendlyTestLoginError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("email not confirmed")) {
    return "Test mode is blocked because the shared test account is not email-confirmed.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Test mode is unavailable right now. The shared test account could not be signed in.";
  }

  if (normalized.includes("rate limit")) {
    return "Test mode is temporarily rate-limited. Please wait a moment and try again.";
  }

  return `Test mode is unavailable right now. ${message}`;
}
