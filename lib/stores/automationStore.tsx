"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../auth-context";
import type { Automation } from "../../types";
import type { AutomationInsert, AutomationUpdate } from "../automations-data";

type AutomationStoreContextValue = {
  automations: Automation[];
  loading: boolean;
  reloadAutomations: () => Promise<void>;
  addAutomation: (automation: AutomationInsert) => Promise<Automation>;
  updateAutomation: (id: string, updates: AutomationUpdate) => Promise<Automation>;
  removeAutomation: (id: string) => Promise<void>;
  toggleAutomation: (id: string) => Promise<Automation>;
};

const AutomationStoreContext = createContext<AutomationStoreContextValue | null>(null);

export function AutomationStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAutomations = useCallback(async () => {
    if (!user) {
      setAutomations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/automations", { cache: "no-store" });
      const json = (await response.json()) as { data?: Automation[]; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load automations.");
      }

      setAutomations(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void loadAutomations();
  }, [authLoading, loadAutomations]);

  const addAutomation = useCallback(async (automation: AutomationInsert) => {
    const response = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ automation }),
    });
    const json = (await response.json()) as { data?: Automation; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to save automation.");
    }

    setAutomations((prev) => [json.data!, ...prev]);
    return json.data;
  }, []);

  const updateAutomation = useCallback(async (id: string, updates: AutomationUpdate) => {
    const response = await fetch("/api/automations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, updates }),
    });
    const json = (await response.json()) as { data?: Automation; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to update automation.");
    }

    setAutomations((prev) => prev.map((item) => (item.id === id ? json.data! : item)));
    return json.data;
  }, []);

  const removeAutomation = useCallback(async (id: string) => {
    const response = await fetch("/api/automations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Failed to delete automation.");
    }

    setAutomations((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleAutomation = useCallback(
    async (id: string) => {
      const current = automations.find((item) => item.id === id);
      if (!current) {
        throw new Error("Automation not found.");
      }

      return updateAutomation(id, { enabled: !current.enabled });
    },
    [automations, updateAutomation],
  );

  const value = useMemo(
    () => ({
      automations,
      loading,
      reloadAutomations: loadAutomations,
      addAutomation,
      updateAutomation,
      removeAutomation,
      toggleAutomation,
    }),
    [
      automations,
      loading,
      loadAutomations,
      addAutomation,
      updateAutomation,
      removeAutomation,
      toggleAutomation,
    ],
  );

  return (
    <AutomationStoreContext.Provider value={value}>
      {children}
    </AutomationStoreContext.Provider>
  );
}

export function useAutomations(): AutomationStoreContextValue {
  const ctx = useContext(AutomationStoreContext);
  if (!ctx) throw new Error("useAutomations must be used inside AutomationStoreProvider");
  return ctx;
}
