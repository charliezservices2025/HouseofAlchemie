"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/(auth)/actions";
import { FormError } from "./form-messages";
import { PasswordField } from "./password-field";
import { SubmitButton } from "./submit-button";

type Props = {
  /** resetPassword or setPassword from the auth actions, passed in by the page */
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  token: string;
  label: string;
  submitLabel: string;
  pendingLabel: string;
};

/** Shared by reset-password and set-password: one new password field and a hidden token. */
export function NewPasswordForm({ action, token, label, submitLabel, pendingLabel }: Props) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={state.error} />
      <input type="hidden" name="token" value={token} />

      <PasswordField
        id="password"
        label={label}
        autoComplete="new-password"
        hint="At least 10 characters with a letter and a number"
        minLength={10}
        value={password}
        onChange={setPassword}
      />

      <SubmitButton pendingLabel={pendingLabel}>{submitLabel}</SubmitButton>
    </form>
  );
}
