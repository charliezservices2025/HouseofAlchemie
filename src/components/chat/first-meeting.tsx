"use client";

import { useActionState } from "react";
import { submitAdvisorIntake } from "@/app/(app)/chat/[advisorSlug]/actions";
import type { ActionState } from "@/app/(auth)/actions";
import type { ChatAdvisor, FirstMeeting } from "./types";

type Props = {
  advisor: ChatAdvisor;
  firstMeeting: FirstMeeting;
  onDone: () => void;
};

/**
 * The advisor's own three to five questions, asked once, before the first
 * message. Answers land in the shared profile so every advisor knows them.
 */
export function FirstMeetingForm({ advisor, firstMeeting, onDone }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, form) => {
    const result = await submitAdvisorIntake(prev, form);
    if (result.ok) onDone();
    return result;
  }, {});

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <p className="eyebrow">First meeting</p>
      <h2 className="mt-3 font-display text-2xl leading-snug text-ink sm:text-[1.75rem]">Before we begin, {advisor.name} has a few questions.</h2>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
        Short answers are fine. Whatever you share here stays with your team at the House, so you only say it once.
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-6">
        <input type="hidden" name="advisorSlug" value={advisor.slug} />
        {firstMeeting.questions.map((q, i) => {
          const id = `first-meeting-${q.id}`;
          return (
            <div key={q.id}>
              <label htmlFor={id} className="block text-[0.9375rem] leading-relaxed text-ink">
                <span className="eyebrow mr-2">{String(i + 1).padStart(2, "0")}</span>
                {q.question}
              </label>
              <textarea
                id={id}
                name={`q_${q.id}`}
                rows={3}
                maxLength={2000}
                placeholder={q.placeholder}
                disabled={pending}
                className="field mt-2 text-[max(1rem,16px)]!"
              />
            </div>
          );
        })}

        {state.error && (
          <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
            {state.error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
          <button type="submit" name="intent" value="answer" disabled={pending} className="btn">
            {pending ? "Saving" : "Begin"}
          </button>
          <button
            type="submit"
            name="intent"
            value="skip"
            formNoValidate
            disabled={pending}
            className="inline-flex min-h-11 items-center text-sm text-ink-muted underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-45"
          >
            Skip for now
          </button>
        </div>
      </form>
    </div>
  );
}
