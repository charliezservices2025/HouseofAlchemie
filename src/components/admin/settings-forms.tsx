"use client";

import { useActionState, useState } from "react";
import { saveIntakeQuestions, savePricing } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/app/(auth)/actions";
import type { IntakeQuestion, ModelPricing } from "@/lib/settings";
import { ActionMessage } from "./action-form";
import { Field } from "./ui";

type QuestionRow = { key: number; id: string; question: string; placeholder: string; required: boolean };

export function IntakeQuestionsForm({ questions: initial }: { questions: IntakeQuestion[] }) {
  const [state, formAction, pending] = useActionState(saveIntakeQuestions, {} as ActionState);
  const [rows, setRows] = useState<QuestionRow[]>(() => initial.map((q, i) => ({ key: i, id: q.id, question: q.question, placeholder: q.placeholder ?? "", required: Boolean(q.required) })));
  const [nextKey, setNextKey] = useState(initial.length);

  function add() {
    setRows((r) => [...r, { key: nextKey, id: "", question: "", placeholder: "", required: false }]);
    setNextKey((k) => k + 1);
  }
  function remove(key: number) {
    setRows((r) => r.filter((q) => q.key !== key));
  }
  function move(key: number, dir: -1 | 1) {
    setRows((r) => {
      const i = r.findIndex((q) => q.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ol className="flex flex-col gap-3">
        {rows.map((q, i) => (
          <li key={q.key} className="card grid gap-3 p-4 sm:grid-cols-[8rem_1fr]">
            <Field label={`Id ${i + 1}`} htmlFor={`iq-${q.key}-id`} hint="Answers are stored under this id, so keep it stable.">
              <input id={`iq-${q.key}-id`} name={`q.${i}.id`} className="field font-mono" defaultValue={q.id} placeholder="auto" pattern="[a-z0-9-]*" maxLength={32} autoComplete="off" />
            </Field>
            <Field label={`Question ${i + 1}`} htmlFor={`iq-${q.key}-question`}>
              <input id={`iq-${q.key}-question`} name={`q.${i}.question`} className="field" defaultValue={q.question} required maxLength={300} autoComplete="off" />
            </Field>
            <Field label="Placeholder" htmlFor={`iq-${q.key}-placeholder`} className="sm:col-span-2">
              <input id={`iq-${q.key}-placeholder`} name={`q.${i}.placeholder`} className="field" defaultValue={q.placeholder} maxLength={200} autoComplete="off" />
            </Field>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
              <label htmlFor={`iq-${q.key}-required`} className="mr-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                <input id={`iq-${q.key}-required`} type="checkbox" name={`q.${i}.required`} value="on" defaultChecked={q.required} className="h-4 w-4 accent-sage" />
                Required
              </label>
              <button type="button" onClick={() => move(q.key, -1)} disabled={i === 0} className="btn btn-ghost min-h-11 px-3 text-[0.6875rem]">
                Move up
              </button>
              <button type="button" onClick={() => move(q.key, 1)} disabled={i === rows.length - 1} className="btn btn-ghost min-h-11 px-3 text-[0.6875rem]">
                Move down
              </button>
              <button type="button" onClick={() => remove(q.key)} className="btn btn-ghost min-h-11 px-3 text-[0.6875rem] text-danger">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} className="btn btn-secondary min-h-11 px-3 text-[0.6875rem]">
          Add a question
        </button>
        <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
          {pending ? "Saving" : "Save intake questions"}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

type PricingRow = { key: number; model: string; input: string; output: string };

export function PricingForm({ pricing }: { pricing: Record<string, ModelPricing> }) {
  const [state, formAction, pending] = useActionState(savePricing, {} as ActionState);
  const entries = Object.entries(pricing);
  const [rows, setRows] = useState<PricingRow[]>(() => entries.map(([model, p], i) => ({ key: i, model, input: String(p.inputPerMillion), output: String(p.outputPerMillion) })));
  const [nextKey, setNextKey] = useState(entries.length);

  function add() {
    setRows((r) => [...r, { key: nextKey, model: "", input: "", output: "" }]);
    setNextKey((k) => k + 1);
  }
  function remove(key: number) {
    setRows((r) => r.filter((p) => p.key !== key));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm" style={{ minWidth: "36rem" }}>
          <caption className="sr-only">Model pricing in dollars per million tokens</caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-ink px-3 py-2.5 text-left font-body text-[0.6875rem] font-normal uppercase tracking-[0.14em] text-ink-muted">Model id</th>
              <th scope="col" className="border-b border-ink px-3 py-2.5 text-left font-body text-[0.6875rem] font-normal uppercase tracking-[0.14em] text-ink-muted">Input, $ per million</th>
              <th scope="col" className="border-b border-ink px-3 py-2.5 text-left font-body text-[0.6875rem] font-normal uppercase tracking-[0.14em] text-ink-muted">Output, $ per million</th>
              <th scope="col" className="border-b border-ink px-3 py-2.5">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.key}>
                <td className="border-b border-line-soft px-3 py-2 align-top">
                  <label htmlFor={`p-${p.key}-model`} className="sr-only">
                    Model id
                  </label>
                  <input id={`p-${p.key}-model`} name={`p.${i}.model`} className="field font-mono" defaultValue={p.model} required pattern="[a-z0-9.\-]{3,60}" autoComplete="off" spellCheck={false} />
                </td>
                <td className="border-b border-line-soft px-3 py-2 align-top">
                  <label htmlFor={`p-${p.key}-input`} className="sr-only">
                    Input price per million tokens
                  </label>
                  <input id={`p-${p.key}-input`} name={`p.${i}.input`} type="number" inputMode="decimal" className="field" defaultValue={p.input} min={0} step="0.01" required />
                </td>
                <td className="border-b border-line-soft px-3 py-2 align-top">
                  <label htmlFor={`p-${p.key}-output`} className="sr-only">
                    Output price per million tokens
                  </label>
                  <input id={`p-${p.key}-output`} name={`p.${i}.output`} type="number" inputMode="decimal" className="field" defaultValue={p.output} min={0} step="0.01" required />
                </td>
                <td className="border-b border-line-soft px-3 py-2 align-top">
                  <button type="button" onClick={() => remove(p.key)} className="btn btn-ghost min-h-11 px-3 text-[0.6875rem] text-danger">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={add} className="btn btn-secondary min-h-11 px-3 text-[0.6875rem]">
          Add a model
        </button>
        <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
          {pending ? "Saving" : "Save pricing"}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
