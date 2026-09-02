"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signUp, type ActionState } from "@/app/(auth)/actions";
import { FormError } from "./form-messages";
import { PasswordField } from "./password-field";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";

export function SignUpForm() {
  const [state, formAction] = useActionState(signUp, {} as ActionState);
  // Controlled so a server side error does not wipe what was typed.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (state.ok) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="text-base leading-relaxed text-ink">{state.message}</p>
        <p className="text-sm leading-relaxed text-ink-muted">
          Nothing there after a few minutes? Check your spam folder, or{" "}
          <Link href="/sign-in" className="text-sage underline underline-offset-4 hover:text-sage-deep">
            sign in
          </Link>{" "}
          to send a new link.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormError message={state.error} />

      <TextField
        id="name"
        name="name"
        type="text"
        label="Name (optional)"
        autoComplete="name"
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

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

      <PasswordField
        id="password"
        autoComplete="new-password"
        hint="At least 10 characters with a letter and a number"
        minLength={10}
        value={password}
        onChange={setPassword}
      />

      <SubmitButton pendingLabel="Creating your account">Create account</SubmitButton>
    </form>
  );
}
