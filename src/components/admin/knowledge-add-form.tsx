"use client";

import { useActionState, useState } from "react";
import { createKnowledgeDocument } from "@/app/(admin)/admin/actions";
import type { ActionState } from "@/app/(auth)/actions";
import { ActionMessage } from "./action-form";
import { Field } from "./ui";

export function KnowledgeAddForm({ advisors }: { advisors: Array<{ slug: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createKnowledgeDocument, {} as ActionState);
  const [mode, setMode] = useState<"paste" | "upload">("paste");

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="k-title" hint="How it appears in citations, like The Priceless Positioning Framework.">
          <input id="k-title" name="title" className="field" required maxLength={160} autoComplete="off" />
        </Field>
        <Field label="Source" htmlFor="k-source" hint="Where it came from: a course module, a workbook, a talk.">
          <input id="k-source" name="sourceName" className="field" required maxLength={160} autoComplete="off" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm text-ink">Which advisors can use it</legend>
        <p className="mb-1 text-xs text-ink-muted">Leave every box empty and all advisors can draw on it.</p>
        <div className="flex flex-wrap gap-x-6">
          {advisors.map((a) => (
            <label key={a.slug} htmlFor={`scope-${a.slug}`} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input id={`scope-${a.slug}`} type="checkbox" name="scope" value={a.slug} className="h-4 w-4 accent-sage" />
              {a.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm text-ink">The text</legend>
        <div className="mb-3 flex gap-1" role="group" aria-label="How to add the text">
          <button type="button" onClick={() => setMode("paste")} aria-pressed={mode === "paste"} className={`btn min-h-11 px-3 text-[0.6875rem] ${mode === "paste" ? "" : "btn-secondary"}`}>
            Paste text
          </button>
          <button type="button" onClick={() => setMode("upload")} aria-pressed={mode === "upload"} className={`btn min-h-11 px-3 text-[0.6875rem] ${mode === "upload" ? "" : "btn-secondary"}`}>
            Upload a file
          </button>
        </div>
        {mode === "paste" ? (
          <Field label="Paste the material" htmlFor="k-text" hint="Plain text or Markdown. Headings and paragraphs help it split into clean passages.">
            <textarea id="k-text" name="text" className="field" rows={12} maxLength={2 * 1024 * 1024} />
          </Field>
        ) : (
          <Field label="Choose a .txt or .md file" htmlFor="k-file" hint="Up to 2 MB. Export Word or Google Docs to plain text first.">
            <input id="k-file" name="file" type="file" accept=".txt,.md,text/plain,text/markdown" className="field py-2 file:mr-3 file:border file:border-ink file:bg-transparent file:px-3 file:py-1.5 file:text-[0.6875rem] file:uppercase file:tracking-[0.14em] file:text-ink" />
          </Field>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn" disabled={pending} aria-busy={pending}>
          {pending ? "Adding" : "Add material"}
        </button>
        <ActionMessage state={state} />
      </div>
    </form>
  );
}
