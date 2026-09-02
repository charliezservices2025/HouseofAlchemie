"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/(app)/settings/actions";
import type { ActionState } from "@/app/(auth)/actions";
import { Notice } from "./notice";

export function ProfileForm({ name, email }: { name: string | null; email: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name ?? "");
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfile, {});

  // The rail shows the name, so let the shell re-read it after a save.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <label htmlFor="profile-name" className="mb-1.5 block text-sm text-ink-soft">
          Name
        </label>
        <input
          id="profile-name"
          name="name"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="name"
          maxLength={80}
          className="field"
        />
        <p className="mt-1.5 text-xs text-ink-muted">Your advisors use this when they speak to you.</p>
      </div>

      <div>
        <label htmlFor="profile-email" className="mb-1.5 block text-sm text-ink-soft">
          Email
        </label>
        {/* .field is unlayered CSS, so plain utilities lose to it. The important variants win. */}
        <input id="profile-email" type="email" value={email} readOnly className="field bg-cream! text-ink-soft!" />
        <p className="mt-1.5 text-xs text-ink-muted">
          This must match the email on your Kajabi account. That match is what grants your access, so it cannot be changed here.
        </p>
      </div>

      <Notice state={state} />

      <div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving" : "Save name"}
        </button>
      </div>
    </form>
  );
}
