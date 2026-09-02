import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getSetting, type IntakeQuestion } from "@/lib/settings";
import { AdvisorForm, type AdvisorFormValues } from "@/components/admin/advisor-form";
import { PageHeader, Pill, TextLink } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Edit advisor" };

export default async function AdminAdvisorPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const [advisor, pricing] = await Promise.all([db.advisor.findUnique({ where: { slug } }), getSetting("usage.pricing")]);
  if (!advisor) notFound();

  const questions = (Array.isArray(advisor.onboardingQuestions) ? advisor.onboardingQuestions : []) as IntakeQuestion[];
  const values: AdvisorFormValues = {
    slug: advisor.slug,
    name: advisor.name,
    title: advisor.title,
    tagline: advisor.tagline,
    description: advisor.description,
    systemPrompt: advisor.systemPrompt,
    neverSay: advisor.neverSay,
    onboardingQuestions: questions.filter((q) => q && typeof q.id === "string" && typeof q.question === "string").map((q) => ({ id: q.id, question: q.question, placeholder: q.placeholder })),
    model: advisor.model,
    monthlyTokenCap: advisor.monthlyTokenCap,
    accentColor: advisor.accentColor,
    kajabiOfferIds: advisor.kajabiOfferIds,
  };

  return (
    <>
      <div className="mb-2 text-sm">
        <TextLink href="/admin/advisors">All advisors</TextLink>
      </div>
      <PageHeader eyebrow={advisor.slug} title={advisor.name} description={advisor.title} actions={advisor.isActive ? <Pill tone="ok">Active</Pill> : <Pill>Off, switch on from the list</Pill>} />
      <div className="max-w-3xl">
        <AdvisorForm advisor={values} models={Object.keys(pricing)} />
      </div>
    </>
  );
}
