"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getSetting, type IntakeQuestion } from "@/lib/settings";
import type { ActionState } from "@/app/(auth)/actions";
import { readAnswers, readQuestions, type Answers } from "@/components/memory/intake-json";

const answerSchema = z.string().trim().max(4000, "Keep each answer under 4000 characters.");
const questionIdSchema = z.string().trim().min(1).max(80);

async function currentUser() {
  const s = await getSession();
  if (!s || !s.user.emailVerifiedAt) return null;
  return s.user;
}

async function writeIntake(userId: string, patch: Answers) {
  const existing = await db.profile.findUnique({ where: { userId }, select: { intake: true } });
  const intake: Answers = { ...readAnswers(existing?.intake), ...patch };
  await db.profile.upsert({
    where: { userId },
    create: { userId, intake },
    update: { intake },
  });
  return intake;
}

function missingRequired(questions: IntakeQuestion[], intake: Answers): IntakeQuestion | undefined {
  return questions.find((q) => q.required && !(intake[q.id] ?? "").trim());
}

/** The intake questions as Erica saved them, with anything malformed dropped. */
async function intakeQuestions(): Promise<IntakeQuestion[]> {
  return readQuestions(await getSetting("intake.questions"));
}

/**
 * Saves one answer as the person moves through the intake, so a closed tab
 * loses nothing. Called directly from the onboarding flow.
 */
export async function saveIntakeAnswer(questionId: string, answer: string): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  const id = questionIdSchema.safeParse(questionId);
  const value = answerSchema.safeParse(answer);
  if (!id.success) return { error: "That question is not recognised." };
  if (!value.success) return { error: value.error.issues[0]?.message ?? "Check your answer and try again." };

  const questions = await intakeQuestions();
  if (!questions.some((q) => q.id === id.data)) return { error: "That question is not recognised." };

  await writeIntake(user.id, { [id.data]: value.data });
  revalidatePath("/memory");
  return { ok: true };
}

/**
 * Saves every intake answer at once. Used when someone who has already
 * joined comes back to revise what they told the House.
 */
export async function saveIntakeAnswers(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  const questions = await intakeQuestions();
  const patch: Answers = {};
  for (const q of questions) {
    const raw = form.get(`answer:${q.id}`);
    const parsed = answerSchema.safeParse(typeof raw === "string" ? raw : "");
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your answers and try again." };
    patch[q.id] = parsed.data;
  }

  const missing = missingRequired(questions, patch);
  if (missing && user.role !== "ADMIN") {
    return { error: `One answer is needed before we can save: "${missing.question}"` };
  }

  await writeIntake(user.id, patch);
  revalidatePath("/memory");
  revalidatePath("/onboarding");
  return { ok: true, message: "Saved. Every advisor will see the update." };
}

/**
 * Marks the intake finished and sends the person to their advisors. Required
 * questions are checked here too, so the client cannot skip past them. Admin
 * accounts may skip entirely.
 */
export async function completeOnboarding(): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  if (!user.onboardedAt) {
    if (user.role !== "ADMIN") {
      const [questions, profile] = await Promise.all([
        intakeQuestions(),
        db.profile.findUnique({ where: { userId: user.id }, select: { intake: true } }),
      ]);
      const missing = missingRequired(questions, readAnswers(profile?.intake));
      if (missing) return { error: `One more before you meet the team: "${missing.question}"` };
    }
    await db.user.update({ where: { id: user.id }, data: { onboardedAt: new Date() } });
  }

  redirect("/advisors");
}
