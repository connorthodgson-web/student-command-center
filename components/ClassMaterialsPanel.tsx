"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { useAuth } from "../lib/auth-context";
import { CLASS_MATERIALS_BUCKET } from "../lib/class-materials";
import type { ClassMaterial } from "../types";

type ClassMaterialsPanelProps = {
  classId: string;
};

export function ClassMaterialsPanel({ classId }: ClassMaterialsPanelProps) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<ClassMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/class-materials?classId=${encodeURIComponent(classId)}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as { data?: ClassMaterial[]; error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load class materials.");
      }

      setMaterials(json.data ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load class materials.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

  const sortedMaterials = useMemo(
    () =>
      [...materials].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
      ),
    [materials],
  );

  const saveNote = async () => {
    const trimmedTitle = noteTitle.trim();
    const trimmedText = noteText.trim();

    if (!trimmedTitle || !trimmedText) {
      setError("Notes need both a title and some text.");
      return;
    }

    setSavingNote(true);
    setError(null);
    try {
      const response = await fetch("/api/class-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material: {
            classId,
            kind: "note",
            title: trimmedTitle,
            rawText: trimmedText,
          },
        }),
      });
      const json = (await response.json()) as { data?: ClassMaterial; error?: string };

      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to save note.");
      }

      setMaterials((prev) => [json.data!, ...prev]);
      setNoteTitle("");
      setNoteText("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const uploadFile = async (file: File | null) => {
    if (!file) return;
    if (!user) {
      setError("You need to be signed in to upload files.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setUploading(true);
    setError(null);
    let storagePath: string | null = null;
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      storagePath = `${user.id}/${classId}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(CLASS_MATERIALS_BUCKET)
        .upload(storagePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const response = await fetch("/api/class-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material: {
            classId,
            kind: "file",
            title: file.name.replace(/\.[^.]+$/, ""),
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            storagePath,
          },
        }),
      });
      const json = (await response.json()) as { data?: ClassMaterial; error?: string };

      if (!response.ok || !json.data) {
        throw new Error(json.error ?? "Failed to save uploaded file.");
      }

      setMaterials((prev) => [json.data!, ...prev]);
    } catch (uploadError) {
      if (storagePath) {
        await supabase.storage.from(CLASS_MATERIALS_BUCKET).remove([storagePath]);
      }
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const deleteMaterial = async (materialId: string) => {
    setDeletingId(materialId);
    setError(null);
    try {
      const response = await fetch("/api/class-materials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: materialId }),
      });
      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to delete material.");
      }

      setMaterials((prev) => prev.filter((material) => material.id !== materialId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete material.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface/40 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">Class materials</p>
        <p className="mt-0.5 text-xs text-muted">
          Upload a handout or paste notes so the assistant has grounded class context later.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface">
            <input
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void uploadFile(file);
                event.currentTarget.value = "";
              }}
              disabled={uploading}
            />
            {uploading ? "Uploading..." : "Upload file"}
          </label>
          <span className="text-xs text-muted">PDFs, docs, handouts, review sheets, or images.</span>
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={noteTitle}
            onChange={(event) => setNoteTitle(event.target.value)}
            placeholder="Note title"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
          />
          <textarea
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Paste study notes, review questions, handout text, or anything this class should remember."
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">Pasted notes are stored as text and can be referenced later.</p>
            <button
              type="button"
              onClick={() => void saveNote()}
              disabled={savingNote}
              className="rounded-full bg-accent-green-foreground px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {savingNote ? "Saving..." : "Save notes"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-accent-rose bg-accent-rose px-4 py-2.5 text-sm text-accent-rose-foreground">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Saved materials</p>
          {!loading && (
            <button
              type="button"
              onClick={() => void loadMaterials()}
              className="text-xs text-muted transition hover:text-foreground"
            >
              Refresh
            </button>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-card px-4 py-4 text-sm text-muted">
            Loading materials...
          </div>
        ) : sortedMaterials.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-sm text-muted">
            No materials saved for this class yet.
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMaterials.map((material) => (
              <div
                key={material.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{material.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {material.kind === "note"
                      ? "Pasted note"
                      : material.fileName ?? material.mimeType ?? "Uploaded file"}
                    {" · "}
                    {new Date(material.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                  {material.kind === "file" && (
                    <p className="mt-1 text-xs text-muted/80">
                      {material.extractionStatus === "completed"
                        ? "Text extracted for assistant use"
                        : material.extractionStatus === "failed"
                          ? `Text extraction failed${material.extractionError ? `: ${material.extractionError}` : ""}`
                          : material.extractionStatus === "not_supported"
                            ? "Stored successfully, but text extraction is not supported for this file type yet"
                            : "Stored file"}
                    </p>
                  )}
                  {material.kind === "note" && material.rawText && (
                    <p className="mt-2 text-sm text-muted">
                      {material.rawText.length > 220
                        ? `${material.rawText.slice(0, 220)}...`
                        : material.rawText}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void deleteMaterial(material.id)}
                  disabled={deletingId === material.id}
                  className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:bg-surface hover:text-foreground disabled:opacity-50"
                >
                  {deletingId === material.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
