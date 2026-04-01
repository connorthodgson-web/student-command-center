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
import type { PlanningItem } from "../../types";
import type { PlanningItemInsert, PlanningItemUpdate } from "../planning-items";

type PlanningStoreContextValue = {
  items: PlanningItem[];
  loading: boolean;
  reloadItems: () => Promise<void>;
  addItem: (item: PlanningItemInsert) => Promise<PlanningItem>;
  updateItem: (id: string, updates: PlanningItemUpdate) => Promise<PlanningItem>;
  removeItem: (id: string) => Promise<void>;
};

const PlanningStoreContext = createContext<PlanningStoreContextValue | null>(null);

export function PlanningStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/planning-items", { cache: "no-store" });
      const json = (await response.json()) as { data?: PlanningItem[]; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load planning items.");
      }

      setItems(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    void loadItems();
  }, [authLoading, loadItems]);

  const addItem = useCallback(async (item: PlanningItemInsert) => {
    const response = await fetch("/api/planning-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item }),
    });
    const json = (await response.json()) as { data?: PlanningItem; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to save planning item.");
    }

    setItems((prev) => [json.data!, ...prev]);
    return json.data;
  }, []);

  const updateItem = useCallback(async (id: string, updates: PlanningItemUpdate) => {
    const response = await fetch("/api/planning-items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, updates }),
    });
    const json = (await response.json()) as { data?: PlanningItem; error?: string };

    if (!response.ok || !json.data) {
      throw new Error(json.error ?? "Failed to update planning item.");
    }

    setItems((prev) => prev.map((item) => (item.id === id ? json.data! : item)));
    return json.data;
  }, []);

  const removeItem = useCallback(async (id: string) => {
    const response = await fetch("/api/planning-items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = (await response.json()) as { error?: string };

    if (!response.ok) {
      throw new Error(json.error ?? "Failed to delete planning item.");
    }

    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({ items, loading, reloadItems: loadItems, addItem, updateItem, removeItem }),
    [items, loading, loadItems, addItem, updateItem, removeItem],
  );

  return (
    <PlanningStoreContext.Provider value={value}>
      {children}
    </PlanningStoreContext.Provider>
  );
}

export function usePlanningStore(): PlanningStoreContextValue {
  const ctx = useContext(PlanningStoreContext);
  if (!ctx) throw new Error("usePlanningStore must be used inside PlanningStoreProvider");
  return ctx;
}
