"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { getSupabaseConfig } from "../../../lib/supabase/env";

type Mode = "login" | "signup";

// Checked at module load time — NEXT_PUBLIC_* vars are available in the browser
const supabaseReady = getSupabaseConfig() !== null;

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
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setSuccess(
          "Account created! Check your email to confirm, then log in."
        );
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

    const TEST_EMAIL = "test@student.dev";
    const TEST_PASSWORD = "test1234";

    // Try signing in first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (!signInError) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Account doesn't exist yet — create it, then sign in
    const { error: signUpError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signUpError) {
      setError("Could not create test account: " + signUpError.message);
      setTestLoading(false);
      return;
    }

    // Sign in after creating account
    const { error: retryError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (retryError) {
      setError(
        "Test account created but sign-in failed. Email confirmation may be required — disable it in Supabase Auth settings."
      );
    } else {
      router.push("/dashboard");
      router.refresh();
    }

    setTestLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Dark hero header — matches the app's existing style */}
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

      {/* Form area */}
      <div className="flex flex-1 items-start justify-center px-8 py-8">
        <div className="w-full max-w-sm">

          {/* Setup notice — only shown when Supabase env vars are missing */}
          {!supabaseReady && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">Supabase not configured</p>
              <p className="mt-1 text-amber-700">
                Add these two lines to <code className="font-mono">.env.local</code>, then restart the dev server:
              </p>
              <pre className="mt-2 rounded bg-amber-100 px-3 py-2 text-xs leading-relaxed text-amber-900 overflow-x-auto">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
              </pre>
              <p className="mt-2 text-amber-700 text-xs">
                Get these from your Supabase project → Settings → API.
              </p>
            </div>
          )}

          {/* Login / Sign up toggle */}
          <div className="mb-6 flex rounded-xl border border-border bg-card p-1 shadow-sm">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-sidebar text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* Success banner */}
          {success && (
            <div className="mb-4 rounded-lg border border-accent-green bg-accent-green/30 px-4 py-3 text-sm text-accent-green-foreground">
              {success}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-accent/20 transition"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:border-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-accent/20 transition"
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
                  ? "Signing in…"
                  : "Creating account…"
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

          {/* Test login — quick access for demos and sharing */}
          {supabaseReady && (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 px-4 py-4">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted/60">
                Test Mode
              </p>
              <button
                type="button"
                onClick={handleTestLogin}
                disabled={testLoading}
                className="w-full rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-foreground transition hover:bg-card disabled:opacity-60"
              >
                {testLoading ? "Signing in…" : "Continue as test student"}
              </button>
              <p className="mt-2 text-center text-xs text-muted/50">
                Uses a shared test account · no email required
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
