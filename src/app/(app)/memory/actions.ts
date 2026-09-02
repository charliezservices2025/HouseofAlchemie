"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";
import { MemoryCategory } from "@/generated/prisma/client";
import type { ActionState } from "@/app/(auth)/actions";
import { readAdvisorAnswers, readAnswers, readQuestions } from "@/components/memory/intake-json";

const CATEGORY_VALUES = Object.values(MemoryCategory) as [MemoryCategory, ...MemoryCategory[]];

const answerSchema = z.string().trim().max(4000, "Keep each answer under 4000 characters.");
const questionIdSchema = z.string().trim().min(1).max(80);
const slugSchema = z.string().trim().min(1).max(40);
const idSchema = z.string().trim().min(1).max(60);
const factSchema = z.object({
  content: z.string().trim().min(3, "Write a little more than that.").max(600, "Keep each memory under 600 characters."),
  category: z.enum(CATEGORY_VALUES, { message: "Choose a category from the list." }),
});

async function currentUser() {
  const s = await getSession();
  if (!s || !s.user.emailVerifiedAt) return null;
  return s.user;
}

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

const SAVED: ActionState = { ok: true, message: "Saved. Your advisors will use the new version from now on." };

/** Corrects one answer from the shared intake. */
export async function updateIntakeAnswer(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  const id = questionIdSchema.safeParse(str(form, "questionId"));
  const answer = answerSchema.safeParse(str(form, "answer"));
  if (!id.success) return { error: "That question is not recognised." };
  if (!answer.success) return { error: answer.error.issues[0]?.message ?? "Check your answer and try again." };

  const questions = readQuestions(await getSetting("intake.questions"));
  const question = questions.find((q) => q.id === id.data);
  if (!question) return { error: "That question is not recognised." };
  if (question.required && !answer.data) return { error: "This one matters to every advisor. A line or two is enough." };

  const existing = await db.profile.findUnique({ where: { userId: user.id }, select: { intake: true } });
  const intake = { ...readAnswers(existing?.intake), [id.data]: answer.data };
  await db.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, intake },
    update: { intake },
  });

  revalidatePath("/memory");
  revalidatePath("/onboarding");
  return SAVED;
}

/** Corrects one answer given to a specific advisor. */
export async function updateAdvisorIntakeAnswer(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  const slug = slugSchema.safeParse(str(form, "advisorSlug"));
  const id = questionIdSchema.safeParse(str(form, "questionId"));
  const answer = answerSchema.safeParse(str(form, "answer"));
  if (!slug.success) return { error: "That advisor is not recognised." };
  if (!id.success) return { error: "That question is not recognised." };
  if (!answer.success) return { error: answer.error.issues[0]?.message ?? "Check your answer and try again." };

  const advisor = await db.advisor.findUnique({ where: { slug: slug.data }, select: { onboardingQuestions: true } });
  if (!advisor) return { error: "That advisor is not recognised." };
  if (!readQuestions(advisor.onboardingQuestions).some((q) => q.id === id.data)) return { error: "That question is not recognised." };

  const existing = await db.profile.findUnique({ where: { userId: user.id }, select: { advisorIntakes: true } });
  const all = readAdvisorAnswers(existing?.advisorIntakes);
  const advisorIntakes = { ...all, [slug.data]: { ...(all[slug.data] ?? {}), [id.data]: answer.data } };
  await db.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, advisorIntakes },
    update: { advisorIntakes },
  });

  revalidatePath("/memory");
  return SAVED;
}

/** Adds a memory the person wants every advisor to hold. */
export async function addMemoryFact(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  const parsed = factSchema.safeParse({ content: str(form, "content"), category: str(form, "category") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  await db.memoryFact.create({
    data: { userId: user.id, category: parsed.data.category, content: parsed.data.content, source: "user" },
  });

  revalidatePath("/memory");
  return { ok: true, message: "Added. Every advisor will know this from now on." };
}

/** Edits a memory. Only rows that belong to the current user can change. */
export async function updateMemoryFact(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  const id = idSchema.safeParse(str(form, "id"));
  if (!id.success) return { error: "That memory could not be found." };
  const parsed = factSchema.safeParse({ content: str(form, "content"), category: str(form, "category") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const result = await db.memoryFact.updateMany({
    where: { id: id.data, userId: user.id, archivedAt: null },
    data: { content: parsed.data.content, category: parsed.data.category },
  });
  if (result.count === 0) return { error: "That memory could not be found." };

  revalidatePath("/memory");
  return SAVED;
}

/** Archives a memory so no advisor uses it again. Nothing is deleted. */
export async function archiveMemoryFact(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await currentUser();
  if (!user) return { error: "Sign in again to continue." };

  const id = idSchema.safeParse(str(form, "id"));
  if (!id.success) return { error: "That memory could not be found." };

  const result = await db.memoryFact.updateMany({
    where: { id: id.data, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (result.count === 0) return { error: "That memory could not be found." };

  revalidatePath("/memory");
  return { ok: true, message: "Forgotten. Your advisors will not use it again." };
}
