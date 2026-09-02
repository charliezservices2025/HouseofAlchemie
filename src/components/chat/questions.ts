import type { AdvisorQuestion } from "./types";

/**
 * Advisor.onboardingQuestions is JSON edited in Admin. Only well formed
 * entries survive, so a typo there degrades to fewer questions, never a crash.
 */
export function parseAdvisorQuestions(raw: unknown): AdvisorQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: AdvisorQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { id, question, placeholder } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id.trim() || typeof question !== "string" || !question.trim()) continue;
    out.push({ id: id.trim(), question: question.trim(), placeholder: typeof placeholder === "string" ? placeholder : undefined });
  }
  return out.slice(0, 5);
}

/** { [questionId]: answer } plus an optional skippedAt marker */
export type AdvisorIntake = Record<string, string>;

export function readAdvisorIntakes(raw: unknown): Record<string, AdvisorIntake> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, AdvisorIntake> = {};
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const answers: AdvisorIntake = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "string") answers[k] = v;
    }
    out[slug] = answers;
  }
  return out;
}

export function hasAnswered(intake: AdvisorIntake | undefined, questions: AdvisorQuestion[]): boolean {
  if (!intake) return false;
  return questions.some((q) => typeof intake[q.id] === "string" && intake[q.id].trim().length > 0);
}

const SKIP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A skip is honoured for a week, then the advisor asks again. */
export function recentlySkipped(intake: AdvisorIntake | undefined): boolean {
  const at = intake?.skippedAt;
  if (!at) return false;
  const t = Date.parse(at);
  return Number.isFinite(t) && Date.now() - t < SKIP_TTL_MS;
}
