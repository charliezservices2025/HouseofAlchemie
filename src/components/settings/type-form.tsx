"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FONT_PRESETS, TEXT_SCALES, type FontPreset, type TextScale } from "@/lib/fonts";
import { updateTypePreferences, type TypeActionState } from "@/app/(app)/settings/actions";
import { Notice } from "./notice";

const SCALE_LABELS: Record<TextScale, string> = { 90: "Smaller", 100: "Default", 110: "Larger", 120: "Largest" };
const PRESET_KEYS = Object.keys(FONT_PRESETS) as FontPreset[];

function applyToDocument(fontPreset: FontPreset, textScale: TextScale) {
  const el = document.documentElement;
  el.dataset.font = fontPreset;
  el.dataset.scale = String(textScale);
}

export function TypeForm({ fontPreset, textScale }: { fontPreset: FontPreset; textScale: TextScale }) {
  const router = useRouter();
  const [font, setFont] = useState<FontPreset>(fontPreset);
  const [scale, setScale] = useState<TextScale>(textScale);
  const [state, action, pending] = useActionState<TypeActionState, FormData>(updateTypePreferences, {});

  // What is actually stored. After a save the action tells us; before that it is the server value.
  const savedFont = state.saved?.fontPreset ?? fontPreset;
  const savedScale = state.saved?.textScale ?? textScale;
  const dirty = font !== savedFont || scale !== savedScale;

  // The type CSS lives on html[data-font] and html[data-scale], so previewing
  // means setting those on the document. Leaving the page without saving
  // puts the stored choice back.
  useEffect(() => {
    applyToDocument(font, scale);
    return () => applyToDocument(savedFont, savedScale);
  }, [font, scale, savedFont, savedScale]);

  // Once saved, let the root layout re-read the preference so every page agrees.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset>
        <legend className="mb-2 text-sm text-ink-soft">Type</legend>
        <div className="border-t border-line">
          {PRESET_KEYS.map((key) => {
            const preset = FONT_PRESETS[key];
            const id = `font-${key}`;
            return (
              <label key={key} htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-line py-3">
                <input
                  id={id}
                  type="radio"
                  name="fontPreset"
                  value={key}
                  checked={font === key}
                  onChange={() => setFont(key)}
                  className="mt-1 h-4 w-4 shrink-0 accent-sage"
                />
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] text-ink">{preset.label}</span>
                  <span className="block text-sm text-ink-muted">{preset.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-ink-soft">Size</legend>
        <div className="grid grid-cols-4 border border-ink">
          {TEXT_SCALES.map((value) => (
            <label
              key={value}
              className="relative flex min-h-11 cursor-pointer items-center justify-center border-l border-ink px-1 text-center text-sm text-ink first:border-l-0 has-checked:bg-ink has-checked:text-paper has-focus-visible:z-10 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-sage"
            >
              <input
                type="radio"
                name="textScale"
                value={value}
                checked={scale === value}
                onChange={() => setScale(value)}
                className="sr-only"
              />
              {SCALE_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="border border-line-soft bg-cream px-4 py-4">
        <p className="eyebrow">Preview</p>
        <p className="font-display mt-2 text-2xl">The whole team, one memory.</p>
        <p className="mt-1 max-w-prose text-ink-soft">
          This is how your conversations will read. Changes preview as you choose them. Save to keep them.
        </p>
      </div>

      <Notice state={state} />

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn" disabled={pending || !dirty}>
          {pending ? "Saving" : "Save type"}
        </button>
        {dirty && !pending ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setFont(savedFont);
              setScale(savedScale);
            }}
          >
            Put it back
          </button>
        ) : null}
      </div>
    </form>
  );
}
