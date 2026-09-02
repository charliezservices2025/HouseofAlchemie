"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  /** Shown while the form is submitting, for example "Signing in" */
  pendingLabel: string;
  className?: string;
};

/** Full width submit button that reads the surrounding form's pending state. */
export function SubmitButton({ children, pendingLabel, className = "" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`btn w-full ${className}`} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
