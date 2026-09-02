import type { InputHTMLAttributes } from "react";

type Props = {
  id: string;
  label: string;
  hint?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

/** A labelled input using the shared .field style. The hint is wired up with aria-describedby. */
export function TextField({ id, label, hint, ...input }: Props) {
  const hintId = `${id}-hint`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-ink-soft">
        {label}
      </label>
      <input id={id} className="field" aria-describedby={hint ? hintId : undefined} {...input} />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
