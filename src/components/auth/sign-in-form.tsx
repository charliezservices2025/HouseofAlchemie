"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, type ActionState } from "@/app/(auth)/actions";
import { FormError } from "./form-messages";
import { PasswordField } from "./password-field";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState(signIn, {} as ActionState);
  // Controlled so a wrong password keeps the email in place. The password itself clears.
  const [email, setEmail] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={state.error} />
      {next && <input type="hidden" name="next" value={next} />}

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

      <div>
        <PasswordField id="password" autoComplete="current-password" />
        <Link href="/forgot-password" className="mt-1 inline-flex min-h-11 items-center text-sm text-sage underline underline-offset-4 hover:text-sage-deep">
          Forgot password
        </Link>
      </div>

      <SubmitButton pendingLabel="Signing in">Sign in</SubmitButton>
    </form>
  );
}
