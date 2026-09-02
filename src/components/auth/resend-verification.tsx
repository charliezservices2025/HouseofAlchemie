"use client";

import { useActionState } from "react";
import { resendVerification, type ActionState } from "@/app/(auth)/actions";
import { FormError, FormNotice } from "./form-messages";
import { SubmitButton } from "./submit-button";

/** Sends a fresh confirmation email. Only useful when there is a session, so pages gate it. */
export function ResendVerification() {
  const [state, formAction] = useActionState(() => resendVerification(), {} as ActionState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormError message={state.error} />
      {state.ok && <FormNotice message={state.message} />}
      <SubmitButton className="btn-secondary" pendingLabel="Sending">
        Send a new link
      </SubmitButton>
    </form>
  );
}
