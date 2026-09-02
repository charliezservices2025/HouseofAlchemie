"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, type ActionState } from "@/app/(auth)/actions";
import { FormError } from "./form-messages";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, {} as ActionState);
  const [email, setEmail] = useState("");

  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="text-base leading-relaxed text-ink">{state.message}</p>
        <p className="text-sm leading-relaxed text-ink-muted">The link works for one hour. If it does not arrive, check your spam folder.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={state.error} />

      <TextField
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <SubmitButton pendingLabel="Sending">Send reset link</SubmitButton>
    </form>
  );
}
