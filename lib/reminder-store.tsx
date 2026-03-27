"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth-context";
import type { ReminderPreference } from "../types";
import {
  DEFAULT_REMINDER_PREFERENCES,
  mergeReminderPreferenceWithDefaults,
} from "./reminder-preferences-data";

type ReminderStoreContextValue = {
  preferences: ReminderPreference;
  loading: boolean;
  updatePreferences: (
    partial: Partial<ReminderPreference>,
  ) => Promise<ReminderPreference>;
};

const ReminderStoreContext = createContext<ReminderStoreContextValue | null>(null);

export function ReminderStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState<ReminderPreference>(DEFAULT_REMINDER_PREFERENCES);
  const [loading, setLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(DEFAULT_REMINDER_PREFERENCES);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/reminders", { cache: "no-store" });
      const json = (await response.json()) as { data?: ReminderPreference; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load reminder preferences.");
      }

      setPreferences(mergeReminderPreferenceWithDefaults(json.data));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void loadPreferences();
  }, [authLoading, loadPreferences]);

  const updatePreferences = useCallback(
    async (partial: Partial<ReminderPreference>) => {
      const response = await fetch("/api/reminders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: partial }),
      });
      const json = (await response.json()) as { data?: ReminderPreference; error?: string };

      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to save reminder preferences.");
      }

      const next = mergeReminderPreferenceWithDefaults(json.data);
      setPreferences(next);
      return next;
    },
    [],
  );

  const value = useMemo(
    () => ({ preferences, loading, updatePreferences }),
    [preferences, loading, updatePreferences],
  );

  return (
    <ReminderStoreContext.Provider value={value}>
      {children}
    </ReminderStoreContext.Provider>
  );
}

export function useReminderStore(): ReminderStoreContextValue {
  const ctx = useContext(ReminderStoreContext);
  if (!ctx) {
    throw new Error("useReminderStore must be used inside ReminderStoreProvider");
  }
  return ctx;
}
