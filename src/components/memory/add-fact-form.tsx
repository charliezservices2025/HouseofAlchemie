"use client";

import { useActionState, useId, useRef } from "react";
import type { ActionState } from "@/app/(auth)/actions";
import { addMemoryFact } from "@/app/(app)/memory/actions";
import { MEMORY_CATEGORIES } from "./categories";

/** Lets the person hand the team a fact directly, without a conversation. */
export function AddFactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const contentId = useId();
  const categoryId = useId();
  const errorId = useId();

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const result = await addMemoryFact(prev, form);
    if (result.ok) formRef.current?.reset();
    return result;
  }, {});

  return (
    <form ref={formRef} action={formAction} className="card p-5">
      <h3 className="font-display text-xl">Add something</h3>
      <p className="mt-1 text-sm text-ink-soft">Anything you want every advisor to hold from now on.</p>

      <label htmlFor={contentId} className="eyebrow mt-5 block">
        What should the team remember
      </label>
      <textarea
        id={contentId}
        name="content"
        className="field mt-2"
        rows={3}
        maxLength={600}
        required
        placeholder="For example: My best clients are wedding planners with teams of five or more."
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? errorId : undefined}
        disabled={pending}
      />

      <label htmlFor={categoryId} className="eyebrow mt-4 block">
        Where it belongs
      </label>
      <select id={categoryId} name="category" defaultValue="OTHER" className="field mt-2" disabled={pending}>
        {MEMORY_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {state.error && (
        <p id={errorId} role="alert" className="mt-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="mt-3 text-sm text-sage">
          {state.message}
        </p>
      )}

      <button type="submit" className="btn mt-5" disabled={pending}>
        {pending ? "Adding" : "Add to memory"}
      </button>
    </form>
  );
}
