"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { IntakeQuestion } from "@/lib/settings";
import { completeOnboarding, saveIntakeAnswer } from "@/app/(app)/onboarding/actions";

type Props = {
  questions: IntakeQuestion[];
  answers: Record<string, string>;
  isAdmin: boolean;
};

const INTRO = -1;

/**
 * One question per screen. Each answer is saved as the person moves on, so
 * a closed tab loses nothing, and the final step marks the intake complete.
 */
export function OnboardingFlow({ questions, answers: initial, isAdmin }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(initial);
  const [step, setStep] = useState<number>(INTRO);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = useId();
  const titleId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const total = questions.length;
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim()).length;
  const hasProgress = answeredCount > 0;

  useEffect(() => {
    if (step >= 0) textareaRef.current?.focus();
  }, [step]);

  function goTo(index: number) {
    setStep(index);
    setDraft(index >= 0 ? (answers[questions[index].id] ?? "") : "");
    setError(null);
  }

  function finish() {
    startTransition(async () => {
      const result = await completeOnboarding();
      if (result?.error) setError(result.error);
    });
  }

  function begin() {
    if (total === 0) {
      finish();
      return;
    }
    const firstOpen = questions.findIndex((q) => !(answers[q.id] ?? "").trim());
    goTo(firstOpen === -1 ? 0 : firstOpen);
  }

  /** Saves the current draft if it changed. Resolves false when saving failed. */
  async function persist(question: IntakeQuestion, value: string): Promise<boolean> {
    if (value === (answers[question.id] ?? "")) return true;
    const result = await saveIntakeAnswer(question.id, value);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    return true;
  }

  function next() {
    const question = questions[step];
    const value = draft.trim();
    if (question.required && !value) {
      setError("This one matters to every advisor. A line or two is enough.");
      return;
    }
    startTransition(async () => {
      if (!(await persist(question, value))) return;
      if (step + 1 >= total) {
        const result = await completeOnboarding();
        if (result?.error) setError(result.error);
        return;
      }
      goTo(step + 1);
    });
  }

  function back() {
    const question = questions[step];
    startTransition(async () => {
      // Going back never blocks on a required answer. Save what is there and move.
      await persist(question, draft.trim());
      goTo(step - 1);
    });
  }

  if (step === INTRO) {
    return (
      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-10 lg:flex-none lg:px-10 lg:py-16" aria-labelledby="onboarding-title">
        <p className="eyebrow">Welcome to the House</p>
        <h1 id="onboarding-title" className="mt-4 font-display text-4xl leading-tight lg:text-5xl">
          Before you meet your advisors, tell the House about your business.
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">Every advisor reads this, so you only say it once.</p>
        <p className="mt-3 text-ink-muted">
          {total === 0
            ? "There is nothing to answer right now. Go straight to your advisors."
            : hasProgress
              ? `${answeredCount} of ${total} answered so far. Pick up where you left off.`
              : `${total} short questions. About five minutes, and you can change any answer later.`}
        </p>
        {error && (
          <p role="alert" className="mt-5 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="safe-bottom mt-auto flex flex-col gap-3 pt-10 lg:mt-0">
          <button type="button" className="btn w-full" onClick={begin} disabled={pending}>
            {total === 0 ? "Meet your advisors" : hasProgress ? "Continue" : "Begin"}
          </button>
          {isAdmin && total > 0 && (
            <button type="button" className="btn btn-ghost w-full" onClick={finish} disabled={pending}>
              Skip for now
            </button>
          )}
        </div>
      </section>
    );
  }

  const question = questions[step];
  const isLast = step + 1 >= total;
  const empty = !draft.trim();
  const primaryLabel = pending ? "Saving" : isLast ? "Finish" : empty && !question.required ? "Skip" : "Next";

  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-8 lg:flex-none lg:px-10 lg:py-14" aria-labelledby={titleId}>
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) next();
        }}
      >
        <p className="eyebrow" aria-live="polite">
          {step + 1} of {total}
        </p>
        <div className="mt-3 h-px w-full bg-line" aria-hidden="true">
          <div className="h-px bg-sage transition-[width] duration-300" style={{ width: `${Math.round(((step + 1) / total) * 100)}%` }} />
        </div>

        <h1 id={titleId} className="mt-8 font-display text-3xl leading-tight lg:text-4xl">
          <label htmlFor={fieldId}>{question.question}</label>
        </h1>
        {!question.required && <p className="mt-2 text-sm text-ink-muted">Optional. Skip it if it does not apply.</p>}

        <textarea
          ref={textareaRef}
          id={fieldId}
          name="answer"
          className="field mt-6"
          rows={5}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          placeholder={question.placeholder}
          maxLength={4000}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={pending}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="safe-bottom mt-auto flex items-center justify-between gap-3 pt-8 lg:mt-0">
          <button type="button" className="btn btn-secondary" onClick={back} disabled={pending}>
            Back
          </button>
          <button type="submit" className="btn" disabled={pending}>
            {primaryLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
