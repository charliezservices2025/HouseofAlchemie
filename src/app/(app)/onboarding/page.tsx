import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { readAnswers, readQuestions } from "@/components/memory/intake-json";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { IntakeEditor } from "@/components/onboarding/intake-editor";

export const metadata: Metadata = { title: "Tell the House about your business" };

/**
 * The shared intake. Taken once, read by every advisor. Someone who has
 * already joined sees their answers for editing instead of the welcome.
 */
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const [rawQuestions, profile] = await Promise.all([
    getSetting("intake.questions"),
    db.profile.findUnique({ where: { userId: user.id }, select: { intake: true } }),
  ]);
  const questions = readQuestions(rawQuestions);
  const answers = readAnswers(profile?.intake);
  const isAdmin = user.role === "ADMIN";

  if (user.onboardedAt) {
    return <IntakeEditor questions={questions} answers={answers} />;
  }

  return <OnboardingFlow questions={questions} answers={answers} isAdmin={isAdmin} />;
}
