"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import type { ActionState } from "@/app/(auth)/actions";
import { confirmEmail } from "./verify-email-action";
import { FormError } from "./form-messages";
import { ResendVerification } from "./resend-verification";
import { SubmitButton } from "./submit-button";

/**
 * Submits the confirmation token as soon as the page loads, so clicking the
 * email link feels instant. The button stays visible as a fallback for when
 * scripting is slow or blocked.
 */
export function ConfirmEmailForm({ token, signedIn }: { token: string; signedIn: boolean }) {
  const [state, formAction, pending] = useActionState(confirmEmail, {} as ActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    formRef.current?.requestSubmit();
  }, []);

  if (state.error) {
    return (
      <div className="flex flex-col gap-5">
        <FormError message={state.error} />
        {signedIn ? (
          <ResendVerification />
        ) : (
          <p className="text-sm leading-relaxed text-ink-soft">
            <Link href="/sign-in" className="text-sage underline underline-offset-4 hover:text-sage-deep">
              Sign in
            </Link>{" "}
            with your email and password and we will send you a fresh one.
          </p>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm leading-relaxed text-ink-soft" aria-live="polite">
        {pending ? "Checking your link." : "If nothing happens in a moment, use the button below."}
      </p>
      <SubmitButton pendingLabel="Confirming">Confirm email</SubmitButton>
    </form>
  );
}
