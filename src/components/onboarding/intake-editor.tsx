"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { IntakeQuestion } from "@/lib/settings";
import type { ActionState } from "@/app/(auth)/actions";
import { saveIntakeAnswers } from "@/app/(app)/onboarding/actions";

type Props = {
  questions: IntakeQuestion[];
  answers: Record<string, string>;
};

/**
 * For someone who has already joined: every intake answer on one page,
 * saved together.
 */
export function IntakeEditor({ questions, answers }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveIntakeAnswers, {});

  return (
    <form action={formAction} className="mx-auto w-full max-w-xl px-5 py-8 lg:px-10 lg:py-14">
      <p className="eyebrow">Your intake</p>
      <h1 className="mt-3 font-display text-3xl leading-tight lg:text-4xl">What you told the House</h1>
      <p className="mt-3 text-ink-soft">You have already met the team. Change anything here and every advisor sees the new version.</p>

      {questions.length === 0 ? (
        <p className="mt-8 text-ink-muted">There are no intake questions at the moment.</p>
      ) : (
        <ol className="mt-8 flex flex-col gap-8">
          {questions.map((q) => (
            <li key={q.id}>
              <label htmlFor={`intake-${q.id}`} className="block font-display text-xl leading-snug">
                {q.question}
              </label>
              {!q.required && <span className="mt-1 block text-xs text-ink-muted">Optional</span>}
              <textarea
                id={`intake-${q.id}`}
                name={`answer:${q.id}`}
                defaultValue={answers[q.id] ?? ""}
                placeholder={q.placeholder}
                className="field mt-3"
                rows={3}
                maxLength={4000}
              />
            </li>
          ))}
        </ol>
      )}

      {state.error && (
        <p role="alert" className="mt-6 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && state.message && (
        <p role="status" className="mt-6 text-sm text-sage">
          {state.message}
        </p>
      )}

      <div className="safe-bottom mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        {questions.length > 0 && (
          <button type="submit" className="btn" disabled={pending}>
            {pending ? "Saving" : "Save answers"}
          </button>
        )}
        <Link href="/advisors" className="btn btn-ghost no-underline">
          Back to your advisors
        </Link>
      </div>
    </form>
  );
}
