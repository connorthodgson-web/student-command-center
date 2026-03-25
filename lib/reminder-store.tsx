"use client";

// TODO: Replace this in-memory store with Supabase-backed persistence once auth is wired up.

import { createContext, useContext, useState } from "react";
import { mockReminderPreference } from "./mock-data";
import type { ReminderPreference } from "../types";

type ReminderStoreContextValue = {
  preferences: ReminderPreference;
  updatePreferences: (partial: Partial<ReminderPreference>) => void;
};

const ReminderStoreContext = createContext<ReminderStoreContextValue | null>(null);

export function ReminderStoreProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<ReminderPreference>(mockReminderPreference);

  const updatePreferences = (partial: Partial<ReminderPreference>) => {
    setPreferences((prev) => ({ ...prev, ...partial }));
  };

  return (
    <ReminderStoreContext.Provider value={{ preferences, updatePreferences }}>
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
