"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = {
  id: string;
  name?: string;
  label?: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  minLength?: number;
  /** Pass value and onChange to keep what was typed when the action returns an error */
  value?: string;
  onChange?: (value: string) => void;
};

/**
 * Password input with a show or hide toggle. The toggle is a real button with
 * its own label, sits inside the field on the right, and is 44px square so it
 * works with a thumb.
 */
export function PasswordField({ id, name = "password", label = "Password", autoComplete, hint, minLength, value, onChange }: Props) {
  const [shown, setShown] = useState(false);
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          className="field pr-12"
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={minLength}
          aria-describedby={hint ? hintId : undefined}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition-colors hover:text-ink"
        >
          {shown ? (
            <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <Eye className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
