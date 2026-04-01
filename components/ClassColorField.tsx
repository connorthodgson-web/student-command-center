"use client";

import { useEffect, useId, useState } from "react";
import {
  CLASS_COLOR_GROUPS,
  CLASS_COLOR_OPTIONS,
  DEFAULT_CLASS_COLOR,
  getClassColorLabel,
  normalizeClassColor,
  resolveClassColor,
} from "../lib/class-colors";

type ClassColorFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
};

export function ClassColorField({
  value,
  onChange,
  label = "Color",
  helperText = "Choose a preset, use the native picker, or paste any hex color.",
}: ClassColorFieldProps) {
  const normalizedColor = resolveClassColor(value);
  const hexInputId = useId();
  const [hexDraft, setHexDraft] = useState(normalizedColor);
  const selectedLabel = getClassColorLabel(normalizedColor);

  useEffect(() => {
    setHexDraft(normalizedColor);
  }, [normalizedColor]);

  const applyColor = (nextValue: string) => {
    const normalized = resolveClassColor(nextValue);
    setHexDraft(normalized);
    onChange(normalized);
  };

  const commitHexDraft = () => {
    const normalizedDraft = normalizeClassColor(hexDraft);
    if (normalizedDraft) {
      applyColor(normalizedDraft);
      return;
    }

    setHexDraft(normalizedColor);
  };

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-foreground">{label}</legend>

      <div className="rounded-2xl border border-border bg-surface/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="h-12 w-12 shrink-0 rounded-2xl border border-border shadow-sm"
            style={{ backgroundColor: normalizedColor }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {selectedLabel} <span className="font-normal text-muted">{normalizedColor}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">{helperText}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {CLASS_COLOR_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted/70">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.options.map((optionValue) => {
                  const option = CLASS_COLOR_OPTIONS.find((item) => item.value === optionValue);
                  const optionLabel = option?.label ?? optionValue;
                  const isSelected = normalizedColor === optionValue;

                  return (
                    <button
                      key={optionValue}
                      type="button"
                      title={optionLabel}
                      aria-label={`Use ${optionLabel}`}
                      onClick={() => applyColor(optionValue)}
                      style={{ backgroundColor: optionValue }}
                      className={`group relative h-9 w-9 rounded-full border-2 transition ${
                        isSelected
                          ? "scale-105 border-foreground shadow-sm"
                          : "border-white/50 hover:scale-105 hover:border-foreground/40"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[auto,1fr,auto]">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <span className="text-xs font-medium text-muted">Picker</span>
            <input
              type="color"
              value={normalizedColor}
              onChange={(event) => applyColor(event.target.value)}
              className="h-9 w-11 cursor-pointer rounded-lg border border-border bg-card p-1"
            />
          </label>

          <label className="block" htmlFor={hexInputId}>
            <span className="mb-1 block text-xs font-medium text-muted">Custom hex</span>
            <input
              id={hexInputId}
              type="text"
              value={hexDraft}
              onChange={(event) => setHexDraft(event.target.value.toUpperCase())}
              onBlur={commitHexDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitHexDraft();
                }
              }}
              placeholder="#D4EDD9"
              spellCheck={false}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-accent-green-foreground/50 focus:ring-2 focus:ring-accent-green/40"
            />
          </label>

          <button
            type="button"
            onClick={() => applyColor(DEFAULT_CLASS_COLOR)}
            className="self-end rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted transition hover:bg-card hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>
    </fieldset>
  );
}
