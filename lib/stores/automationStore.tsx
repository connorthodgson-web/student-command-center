"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Automation } from "../../types";

// TODO: Replace localStorage with Supabase persistence once the automations
// table is created. Follow the pattern in lib/stores/classStore.tsx.
const STORAGE_KEY = "scc_automations_v1";

type AutomationStoreContextValue = {
  automations: Automation[];
  addAutomation: (automation: Omit<Automation, "id" | "createdAt" | "updatedAt">) => void;
  updateAutomation: (id: string, updates: Partial<Automation>) => void;
  removeAutomation: (id: string) => void;
  toggleAutomation: (id: string) => void;
};

const AutomationStoreContext = createContext<AutomationStoreContextValue | null>(null);

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function AutomationStoreProvider({ children }: { children: React.ReactNode }) {
  const [automations, setAutomations] = useState<Automation[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setAutomations(JSON.parse(raw) as Automation[]);
    } catch {
      // Silently ignore parse or storage errors
    }
  }, []);

  const persist = useCallback((next: Automation[]) => {
    setAutomations(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Silently ignore storage errors
    }
  }, []);

  const addAutomation = useCallback(
    (automation: Omit<Automation, "id" | "createdAt" | "updatedAt">) => {
      const now = new Date().toISOString();
      const next: Automation = { ...automation, id: newId(), createdAt: now, updatedAt: now };
      persist([...automations, next]);
    },
    [automations, persist]
  );

  const updateAutomation = useCallback(
    (id: string, updates: Partial<Automation>) => {
      persist(
        automations.map((a) =>
          a.id === id ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
        )
      );
    },
    [automations, persist]
  );

  const removeAutomation = useCallback(
    (id: string) => {
      persist(automations.filter((a) => a.id !== id));
    },
    [automations, persist]
  );

  const toggleAutomation = useCallback(
    (id: string) => {
      persist(
        automations.map((a) =>
          a.id === id
            ? { ...a, enabled: !a.enabled, updatedAt: new Date().toISOString() }
            : a
        )
      );
    },
    [automations, persist]
  );

  return (
    <AutomationStoreContext.Provider
      value={{ automations, addAutomation, updateAutomation, removeAutomation, toggleAutomation }}
    >
      {children}
    </AutomationStoreContext.Provider>
  );
}

export function useAutomations(): AutomationStoreContextValue {
  const ctx = useContext(AutomationStoreContext);
  if (!ctx) throw new Error("useAutomations must be used inside AutomationStoreProvider");
  return ctx;
}
