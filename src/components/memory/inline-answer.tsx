"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ActionState } from "@/app/(auth)/actions";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

type Props = {
  question: string;
  value: string;
  /** Hidden fields the action needs, such as questionId or advisorSlug */
  hidden: Record<string, string>;
  action: Action;
  placeholder?: string;
  optional?: boolean;
};

/**
 * A question and its answer. Edit reveals a textarea in place; Save runs the
 * server action and closes it again when the save succeeds.
 */
export function InlineAnswer({ question, value, hidden, action, placeholder, optional }: Props) {
  const [editing, setEditing] = useState(false);
  const fieldId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const result = await action(prev, form);
    if (result.ok) setEditing(false);
    return result;
  }, {});

  // Opening moves focus into the textarea. Closing hands it back to Edit so a
  // keyboard or screen reader user is never left nowhere.
  useEffect(() => {
    if (editing) textareaRef.current?.focus();
    else if (wasEditing.current) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  return (
    <div className="border-b border-line-soft py-5">
      <div className="flex items-start justify-between gap-4">
        <p className="font-display text-lg leading-snug">
          {question}
          {optional && <span className="ml-2 align-middle text-xs tracking-wide text-ink-muted">Optional</span>}
        </p>
        {!editing && (
          <button ref={editButtonRef} type="button" className="btn btn-ghost -mr-3 -mt-2 shrink-0 px-3" onClick={() => setEditing(true)} aria-label={`Edit: ${question}`}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <form action={formAction} className="mt-3">
          {Object.entries(hidden).map(([name, v]) => (
            <input key={name} type="hidden" name={name} value={v} />
          ))}
          <label htmlFor={fieldId} className="sr-only">
            Your answer: {question}
          </label>
          <textarea
            ref={textareaRef}
            id={fieldId}
            name="answer"
            defaultValue={value}
            placeholder={placeholder}
            className="field"
            rows={4}
            maxLength={4000}
            aria-invalid={state.error ? true : undefined}
            aria-describedby={state.error ? errorId : undefined}
            disabled={pending}
          />
          {state.error && (
            <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
              {state.error}
            </p>
          )}
          <div className="mt-3 flex gap-3">
            <button type="submit" className="btn" disabled={pending}>
              {pending ? "Saving" : "Save"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className={`mt-2 whitespace-pre-wrap break-words leading-relaxed ${value ? "text-ink-soft" : "italic text-ink-muted"}`}>{value || "Not answered yet."}</p>
          {state.ok && state.message && (
            <p role="status" className="mt-2 text-sm text-sage">
              {state.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
