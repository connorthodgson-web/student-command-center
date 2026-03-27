"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// TODO: Replace localStorage check with Supabase auth-based profile check once auth is set up
const ONBOARDING_KEY = "scc-onboarding";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_KEY);
      const data = raw ? (JSON.parse(raw) as { onboardingComplete?: boolean }) : {};
      if (data.onboardingComplete) {
        router.replace("/dashboard");
      } else {
        router.replace("/onboarding");
      }
    } catch {
      router.replace("/onboarding");
    }
  }, [router]);

  // Render nothing while redirecting
  return null;
}
