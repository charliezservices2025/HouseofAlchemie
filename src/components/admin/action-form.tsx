"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/(auth)/actions";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

export function ActionMessage({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="border border-sage bg-sage-whisper px-3 py-2 text-sm text-sage-deep">
        {state.message}
      </p>
    );
  }
  return null;
}

/**
 * A form around a server action. Children can come from a server component;
 * the submit button, pending state and the result message live here.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving",
  confirm,
  variant = "btn",
  className = "",
  hidden = {},
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  confirm?: string;
  variant?: "btn" | "btn btn-secondary" | "btn btn-sage" | "btn btn-secondary text-danger border-danger";
  className?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  return (
    <form
      action={formAction}
      className={`flex flex-col gap-4 ${className}`}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={variant} disabled={pending} aria-busy={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

/** A single button that runs a server action, for rows and small panels. */
export function ActionButton({
  action,
  label,
  pendingLabel = "Working",
  confirm,
  hidden,
  variant = "btn btn-secondary",
  small = true,
}: {
  action: Action;
  label: string;
  pendingLabel?: string;
  confirm?: string;
  hidden: Record<string, string>;
  variant?: string;
  small?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-start gap-2"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className={`${variant} ${small ? "min-h-11 px-3 text-[0.6875rem]" : ""}`} disabled={pending} aria-busy={pending}>
        {pending ? pendingLabel : label}
      </button>
      {(state.error || (state.ok && state.message)) && (
        <span role={state.error ? "alert" : "status"} className={`max-w-xs text-xs leading-snug ${state.error ? "text-danger" : "text-sage-deep"}`}>
          {state.error ?? state.message}
        </span>
      )}
    </form>
  );
}
