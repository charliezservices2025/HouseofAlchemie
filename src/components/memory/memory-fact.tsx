"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ActionState } from "@/app/(auth)/actions";
import { archiveMemoryFact, updateMemoryFact } from "@/app/(app)/memory/actions";
import { MEMORY_CATEGORIES } from "./categories";

export type FactView = {
  id: string;
  content: string;
  category: string;
  /** Already worded for people, for example "Added by you" or "From a conversation with Evren" */
  sourceLabel: string;
  /** Already formatted on the server so the page never shifts on hydration */
  dateLabel: string;
};

type Mode = "view" | "edit" | "forget";

/**
 * One remembered fact. Edit opens the text and category in place. Forget
 * asks once, then archives the row so no advisor uses it again.
 */
export function MemoryFactRow({ fact }: { fact: FactView }) {
  const [mode, setMode] = useState<Mode>("view");
  const contentId = useId();
  const categoryId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const lastMode = useRef<Mode>("view");

  const [editState, editAction, editPending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const result = await updateMemoryFact(prev, form);
    if (result.ok) setMode("view");
    return result;
  }, {});

  const [forgetState, forgetAction, forgetPending] = useActionState<ActionState, FormData>(archiveMemoryFact, {});

  // Edit moves focus into the textarea. Returning to view hands it back to the
  // Edit button so keyboard focus is never dropped on the floor.
  useEffect(() => {
    if (mode === "edit") textareaRef.current?.focus();
    else if (mode === "view" && lastMode.current !== "view") editButtonRef.current?.focus();
    lastMode.current = mode;
  }, [mode]);

  const busy = editPending || forgetPending;

  if (mode === "edit") {
    return (
      <li className="border-b border-line-soft py-4">
        <form action={editAction}>
          <input type="hidden" name="id" value={fact.id} />
          <label htmlFor={contentId} className="eyebrow block">
            What to remember
          </label>
          <textarea
            ref={textareaRef}
            id={contentId}
            name="content"
            defaultValue={fact.content}
            className="field mt-2"
            rows={3}
            maxLength={600}
            required
            aria-invalid={editState.error ? true : undefined}
            aria-describedby={editState.error ? errorId : undefined}
            disabled={busy}
          />
          <label htmlFor={categoryId} className="eyebrow mt-4 block">
            Where it belongs
          </label>
          <select id={categoryId} name="category" defaultValue={fact.category} className="field mt-2" disabled={busy}>
            {MEMORY_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {editState.error && (
            <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
              {editState.error}
            </p>
          )}
          <div className="mt-3 flex gap-3">
            <button type="submit" className="btn" disabled={busy}>
              {editPending ? "Saving" : "Save"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode("view")} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="border-b border-line-soft py-4">
      <p className="whitespace-pre-wrap break-words leading-relaxed text-ink">{fact.content}</p>
      <p className="mt-1.5 text-xs text-ink-muted">
        {fact.sourceLabel}, {fact.dateLabel}
      </p>

      {mode === "forget" ? (
        <form action={forgetAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={fact.id} />
          <p className="w-full text-sm text-ink-soft">Forget this? Your advisors will stop using it. Nothing else changes.</p>
          <button type="submit" className="btn" disabled={busy}>
            {forgetPending ? "Forgetting" : "Yes, forget it"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setMode("view")} disabled={busy}>
            Keep it
          </button>
          {forgetState.error && (
            <p role="alert" className="w-full text-sm text-danger">
              {forgetState.error}
            </p>
          )}
        </form>
      ) : (
        <div className="-ml-3 mt-1 flex gap-1">
          <button ref={editButtonRef} type="button" className="btn btn-ghost px-3" onClick={() => setMode("edit")} aria-label={`Edit: ${fact.content.slice(0, 60)}`}>
            Edit
          </button>
          <button type="button" className="btn btn-ghost px-3" onClick={() => setMode("forget")} aria-label={`Forget: ${fact.content.slice(0, 60)}`}>
            Forget
          </button>
          {editState.ok && editState.message && (
            <span role="status" className="self-center text-sm text-sage">
              {editState.message}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
