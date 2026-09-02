"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { changePassword, type ActionState } from "@/app/(auth)/actions";
import { Notice } from "./notice";

async function submit(prev: ActionState, form: FormData): Promise<ActionState> {
  // A typo guard only. The server sets whatever arrives in "password".
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next !== confirm) return { error: "The new passwords do not match." };
  return changePassword(prev, form);
}

export function PasswordForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionState, FormData>(submit, {});

  // Changing the password signs out every other device, so refresh the sessions list.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <label htmlFor="password-current" className="mb-1.5 block text-sm text-ink-soft">
          Current password
        </label>
        <input id="password-current" name="current" type="password" autoComplete="current-password" required className="field" />
      </div>

      <div>
        <label htmlFor="password-new" className="mb-1.5 block text-sm text-ink-soft">
          New password
        </label>
        <input
          id="password-new"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          className="field"
        />
        <p className="mt-1.5 text-xs text-ink-muted">At least 10 characters, with a letter and a number.</p>
      </div>

      <div>
        <label htmlFor="password-confirm" className="mb-1.5 block text-sm text-ink-soft">
          Confirm new password
        </label>
        <input
          id="password-confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          className="field"
        />
      </div>

      <Notice state={state} />

      <div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Changing" : "Change password"}
        </button>
      </div>
    </form>
  );
}
