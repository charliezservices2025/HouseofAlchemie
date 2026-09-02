"use client";

import { useActionState, useState } from "react";
import { updateAdvisor } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/app/(auth)/actions";
import { ActionMessage } from "./action-form";
import { Field } from "./ui";
import { conversationsFromCap, formatNumber } from "./format";

export type AdvisorFormValues = {
  slug: string;
  name: string;
  title: string;
  tagline: string;
  description: string;
  systemPrompt: string;
  neverSay: string[];
  onboardingQuestions: Array<{ id: string; question: string; placeholder?: string }>;
  model: string;
  monthlyTokenCap: number;
  accentColor: string | null;
  kajabiOfferIds: string[];
};

type QuestionRow = { key: number; id: string; question: string; placeholder: string };

export function AdvisorForm({ advisor, models }: { advisor: AdvisorFormValues; models: string[] }) {
  const [state, formAction, pending] = useActionState(updateAdvisor, {} as ActionState);
  const [questions, setQuestions] = useState<QuestionRow[]>(() =>
    advisor.onboardingQuestions.map((q, i) => ({ key: i, id: q.id, question: q.question, placeholder: q.placeholder ?? "" })),
  );
  const [nextKey, setNextKey] = useState(advisor.onboardingQuestions.length);
  const [cap, setCap] = useState(advisor.monthlyTokenCap);

  const modelOptions = models.includes(advisor.model) ? models : [advisor.model, ...models];

  function addQuestion() {
    setQuestions((qs) => [...qs, { key: nextKey, id: "", question: "", placeholder: "" }]);
    setNextKey((k) => k + 1);
  }
  function removeQuestion(key: number) {
    setQuestions((qs) => qs.filter((q) => q.key !== key));
  }
  function move(key: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="slug" value={advisor.slug} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="eyebrow mb-3 w-full">Identity</legend>
        <Field label="Name" htmlFor="name">
          <input id="name" name="name" className="field" defaultValue={advisor.name} required maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Title" htmlFor="title" hint="Shown under the name, like The Wealth Architect.">
          <input id="title" name="title" className="field" defaultValue={advisor.title} required maxLength={80} autoComplete="off" />
        </Field>
        <Field label="Tagline" htmlFor="tagline" className="sm:col-span-2">
          <input id="tagline" name="tagline" className="field" defaultValue={advisor.tagline} required maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Description" htmlFor="description" className="sm:col-span-2" hint="Shown on the advisor card before a subscriber opens a conversation.">
          <textarea id="description" name="description" className="field" rows={4} defaultValue={advisor.description} required maxLength={4000} />
        </Field>
        <Field label="Accent colour" htmlFor="accentColor" hint="Six digit hex. Leave blank for the house sage.">
          <div className="flex items-center gap-3">
            <input id="accentColor" name="accentColor" className="field font-mono" defaultValue={advisor.accentColor ?? ""} placeholder="#2a544b" pattern="^#[0-9a-fA-F]{6}$" maxLength={7} autoComplete="off" />
            <span aria-hidden="true" className="h-11 w-11 shrink-0 border border-line" style={{ background: advisor.accentColor ?? "#2a544b" }} />
          </div>
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow mb-3 w-full">Voice</legend>
        <Field label="System prompt" htmlFor="systemPrompt" hint="The whole personality, method and boundaries. Subscribers never see this text, but every answer comes from it.">
          <textarea id="systemPrompt" name="systemPrompt" className="field font-mono" rows={18} defaultValue={advisor.systemPrompt} required spellCheck={false} />
        </Field>
        <Field label="Never say" htmlFor="neverSay" hint="One phrase per line. These are appended to the prompt as hard rules.">
          <textarea id="neverSay" name="neverSay" className="field" rows={6} defaultValue={advisor.neverSay.join("\n")} />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="eyebrow mb-3 w-full">First conversation questions</legend>
        <p className="text-sm text-ink-muted">Asked once, the first time a subscriber meets this advisor. Leave the id blank and it is made from the question.</p>
        {questions.length === 0 && <p className="card px-4 py-4 text-sm text-ink-muted">No questions yet. The advisor will open with the shared intake only.</p>}
        <ol className="flex flex-col gap-3">
          {questions.map((q, i) => (
            <li key={q.key} className="card grid gap-3 p-4 sm:grid-cols-[8rem_1fr]">
              <Field label={`Id ${i + 1}`} htmlFor={`q-${q.key}-id`}>
                <input id={`q-${q.key}-id`} name={`q.${i}.id`} className="field font-mono" defaultValue={q.id} placeholder="auto" pattern="[a-z0-9-]*" maxLength={32} autoComplete="off" />
              </Field>
              <Field label={`Question ${i + 1}`} htmlFor={`q-${q.key}-question`}>
                <input id={`q-${q.key}-question`} name={`q.${i}.question`} className="field" defaultValue={q.question} required maxLength={300} autoComplete="off" />
              </Field>
              <Field label="Placeholder" htmlFor={`q-${q.key}-placeholder`} className="sm:col-span-2" hint="Optional. Grey hint text inside the answer box.">
                <input id={`q-${q.key}-placeholder`} name={`q.${i}.placeholder`} className="field" defaultValue={q.placeholder} maxLength={200} autoComplete="off" />
              </Field>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <button type="button" onClick={() => move(q.key, -1)} disabled={i === 0} className="btn btn-ghost min-h-11 px-3 text-[0.6875rem]">
                  Move up
                </button>
                <button type="button" onClick={() => move(q.key, 1)} disabled={i === questions.length - 1} className="btn btn-ghost min-h-11 px-3 text-[0.6875rem]">
                  Move down
                </button>
                <button type="button" onClick={() => removeQuestion(q.key)} className="btn btn-ghost min-h-11 px-3 text-[0.6875rem] text-danger">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <button type="button" onClick={addQuestion} className="btn btn-secondary min-h-11 px-3 text-[0.6875rem]">
            Add a question
          </button>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="eyebrow mb-3 w-full">Model and cost</legend>
        <Field label="Model" htmlFor="model" hint="Only models with pricing in Settings can be chosen, so usage can be costed.">
          <select id="model" name="model" className="field" defaultValue={advisor.model}>
            {modelOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Monthly token cap" htmlFor="monthlyTokenCap" hint={`${formatNumber(cap)} tokens is ${conversationsFromCap(cap)}, estimated at 1,200 tokens per exchange. Input and output both count.`}>
          <input
            id="monthlyTokenCap"
            name="monthlyTokenCap"
            type="number"
            inputMode="numeric"
            className="field"
            defaultValue={advisor.monthlyTokenCap}
            min={1000}
            max={100000000}
            step={1000}
            required
            onChange={(e) => setCap(Number(e.target.value) || 0)}
          />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="eyebrow mb-3 w-full">Kajabi</legend>
        <Field
          label="Kajabi offer ids"
          htmlFor="kajabiOfferIds"
          hint="One offer id per line. A purchase of any of these grants this advisor. Every plan on the sales page includes Evren, so add each specialist's offer id to Evren as well."
        >
          <textarea id="kajabiOfferIds" name="kajabiOfferIds" className="field font-mono" rows={4} defaultValue={advisor.kajabiOfferIds.join("\n")} spellCheck={false} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
          {pending ? "Saving" : "Save advisor"}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
