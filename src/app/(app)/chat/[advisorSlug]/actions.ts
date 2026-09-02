"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getUnlockedAdvisor } from "@/lib/entitlements";
import type { ActionState } from "@/app/(auth)/actions";
import { parseAdvisorQuestions, readAdvisorIntakes, type AdvisorIntake } from "@/components/chat/questions";

const MAX_ANSWER = 2000;

const intakeSchema = z.object({
  advisorSlug: z.string().trim().min(1).max(40),
  intent: z.enum(["answer", "skip"]).catch("answer"),
});

const answerSchema = z.string().trim().max(MAX_ANSWER).catch("");

/**
 * Saves the answers to an advisor's own first meeting questions into
 * Profile.advisorIntakes[slug], merging so other advisors' answers are kept.
 * A skip records skippedAt instead, and the advisor asks again in a week.
 */
export async function submitAdvisorIntake(_prev: ActionState, form: FormData): Promise<ActionState> {
  const s = await getSession();
  if (!s || !s.user.emailVerifiedAt) return { error: "Sign in again." };

  const parsed = intakeSchema.safeParse({ advisorSlug: form.get("advisorSlug"), intent: form.get("intent") });
  if (!parsed.success) return { error: "That advisor was not recognised." };
  const { advisorSlug: slug, intent } = parsed.data;

  const access = await getUnlockedAdvisor(s.user.id, slug);
  if (!access) return { error: "This advisor is not part of your plan yet." };
  const { advisor } = access;

  const questions = parseAdvisorQuestions(advisor.onboardingQuestions);

  const answers: AdvisorIntake = {};
  for (const q of questions) {
    const raw = form.get(`q_${q.id}`);
    const value = answerSchema.parse(typeof raw === "string" ? raw.slice(0, MAX_ANSWER) : "");
    if (value) answers[q.id] = value;
  }
  if (intent === "answer" && Object.keys(answers).length === 0) {
    return { error: "Answer at least one, or skip for now." };
  }

  const existing = await db.profile.findUnique({ where: { userId: s.user.id }, select: { advisorIntakes: true } });
  const all = readAdvisorIntakes(existing?.advisorIntakes);
  const current = all[slug] ?? {};

  let next: AdvisorIntake;
  if (intent === "skip") {
    next = { ...current, skippedAt: new Date().toISOString() };
  } else {
    const rest = { ...current };
    delete rest.skippedAt;
    next = { ...rest, ...answers };
  }
  const merged = { ...all, [slug]: next };

  await db.profile.upsert({
    where: { userId: s.user.id },
    create: { userId: s.user.id, advisorIntakes: merged },
    update: { advisorIntakes: merged },
  });

  revalidatePath(`/chat/${slug}`);
  return {
    ok: true,
    message: intent === "skip" ? `No problem. You can tell ${advisor.name} later.` : `Thank you. ${advisor.name} will remember this.`,
  };
}
