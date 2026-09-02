import type { IntakeQuestion } from "@/lib/settings";

/**
 * Profile.intake and Profile.advisorIntakes are JSON columns. These readers
 * turn whatever is stored into the shapes the screens expect and drop
 * anything that is not a string, so a bad row can never break a page.
 */

export type Answers = Record<string, string>;

export function readAnswers(value: unknown): Answers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Answers = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function readAdvisorAnswers(value: unknown): Record<string, Answers> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, Answers> = {};
  for (const [slug, answers] of Object.entries(value as Record<string, unknown>)) {
    out[slug] = readAnswers(answers);
  }
  return out;
}

export function readQuestions(value: unknown): IntakeQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (q): q is IntakeQuestion =>
        !!q && typeof q === "object" && typeof (q as IntakeQuestion).id === "string" && typeof (q as IntakeQuestion).question === "string",
    )
    .map((q) => ({
      id: q.id,
      question: q.question,
      placeholder: typeof q.placeholder === "string" ? q.placeholder : undefined,
      required: q.required === true,
    }));
}
