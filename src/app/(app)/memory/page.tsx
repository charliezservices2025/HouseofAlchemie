import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { readAdvisorAnswers, readAnswers, readQuestions } from "@/components/memory/intake-json";
import { MEMORY_CATEGORIES } from "@/components/memory/categories";
import { InlineAnswer } from "@/components/memory/inline-answer";
import { MemoryFactRow, type FactView } from "@/components/memory/memory-fact";
import { AddFactForm } from "@/components/memory/add-fact-form";
import { updateAdvisorIntakeAnswer, updateIntakeAnswer } from "./actions";

export const metadata: Metadata = { title: "Your business profile" };

const dateFormat = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" });

/**
 * What we remember. Everything the advisors know about this person, in one
 * place, each piece correctable. Nothing here is deleted, only forgotten.
 */
export default async function MemoryPage() {
  const user = await requireUser("/memory");

  const [rawQuestions, profile, facts, summaries] = await Promise.all([
    getSetting("intake.questions"),
    db.profile.findUnique({ where: { userId: user.id } }),
    db.memoryFact.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { createdAt: "desc" } }),
    db.conversation.findMany({
      where: { userId: user.id, archivedAt: null, summary: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, summary: true, updatedAt: true, advisor: { select: { name: true, slug: true } } },
    }),
  ]);

  const questions = readQuestions(rawQuestions);
  const intake = readAnswers(profile?.intake);
  const advisorIntakes = readAdvisorAnswers(profile?.advisorIntakes);

  const advisorSlugs = Object.keys(advisorIntakes);
  const conversationSources = [...new Set(facts.map((f) => f.source).filter((s) => s !== "intake" && s !== "user"))];

  const [advisors, sourceConversations] = await Promise.all([
    advisorSlugs.length
      ? db.advisor.findMany({
          where: { slug: { in: advisorSlugs } },
          orderBy: { sortOrder: "asc" },
          select: { slug: true, name: true, onboardingQuestions: true },
        })
      : Promise.resolve([]),
    conversationSources.length
      ? db.conversation.findMany({
          where: { userId: user.id, id: { in: conversationSources } },
          select: { id: true, title: true, advisor: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const conversationById = new Map(sourceConversations.map((c) => [c.id, c]));
  function sourceLabel(source: string): string {
    if (source === "user") return "Added by you";
    if (source === "intake") return "From your intake";
    const convo = conversationById.get(source);
    return convo ? `From a conversation with ${convo.advisor.name}` : "From a conversation";
  }

  const factViews: FactView[] = facts.map((f) => ({
    id: f.id,
    content: f.content,
    category: f.category,
    sourceLabel: sourceLabel(f.source),
    dateLabel: dateFormat.format(f.createdAt),
  }));
  const groups = MEMORY_CATEGORIES.map((c) => ({ ...c, facts: factViews.filter((f) => f.category === c.value) })).filter((g) => g.facts.length > 0);

  const advisorSections = advisors
    .map((a) => {
      const answers = advisorIntakes[a.slug] ?? {};
      const advisorQuestions = readQuestions(a.onboardingQuestions).filter((q) => q.id in answers);
      return { slug: a.slug, name: a.name, questions: advisorQuestions, answers };
    })
    .filter((s) => s.questions.length > 0);

  const intakeStarted = questions.some((q) => (intake[q.id] ?? "").trim());

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 lg:px-10 lg:py-12">
      <header>
        <p className="eyebrow">What we remember</p>
        <h1 className="mt-3 font-display text-3xl leading-tight lg:text-4xl">Your business profile</h1>
        <p className="mt-3 text-ink-soft">Everything your advisors know about you. Correct anything that is out of date.</p>
      </header>

      {/* 1. The shared intake */}
      <section className="mt-12 border-t border-line pt-8" aria-labelledby="intake-heading">
        <h2 id="intake-heading" className="font-display text-2xl">
          What you told the House
        </h2>
        <p className="mt-2 text-sm text-ink-soft">Your answers from the day you joined. Every advisor reads these before she says a word.</p>

        {!intakeStarted && !user.onboardedAt && (
          <p className="mt-4 text-sm text-ink-muted">
            You have not been through the intake yet.{" "}
            <Link href="/onboarding" className="text-sage underline underline-offset-4">
              Start it here
            </Link>
            .
          </p>
        )}

        {questions.length === 0 ? (
          <p className="mt-6 text-ink-muted">There are no intake questions at the moment.</p>
        ) : (
          <div className="mt-4">
            {questions.map((q) => (
              <InlineAnswer
                key={q.id}
                question={q.question}
                value={intake[q.id] ?? ""}
                placeholder={q.placeholder}
                optional={!q.required}
                hidden={{ questionId: q.id }}
                action={updateIntakeAnswer}
              />
            ))}
          </div>
        )}
      </section>

      {/* 2. Per advisor questions */}
      <section className="mt-12 border-t border-line pt-8" aria-labelledby="advisors-heading">
        <h2 id="advisors-heading" className="font-display text-2xl">
          What you told each advisor
        </h2>
        <p className="mt-2 text-sm text-ink-soft">Each advisor asks a few questions of her own the first time you meet. Only she reads these.</p>

        {advisorSections.length === 0 ? (
          <p className="mt-6 text-ink-muted">Nothing yet. Once you have met an advisor, what you told her appears here.</p>
        ) : (
          advisorSections.map((s) => (
            <div key={s.slug} className="mt-8">
              <h3 className="eyebrow">{s.name}</h3>
              <div className="mt-1">
                {s.questions.map((q) => (
                  <InlineAnswer
                    key={`${s.slug}:${q.id}`}
                    question={q.question}
                    value={s.answers[q.id] ?? ""}
                    placeholder={q.placeholder}
                    hidden={{ advisorSlug: s.slug, questionId: q.id }}
                    action={updateAdvisorIntakeAnswer}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* 3. Memory facts */}
      <section className="mt-12 border-t border-line pt-8" aria-labelledby="facts-heading">
        <h2 id="facts-heading" className="font-display text-2xl">
          What the team has remembered
        </h2>
        <p className="mt-2 text-sm text-ink-soft">Advisors add to this as you talk. Anything you forget here is no longer used.</p>

        <div className="mt-6">
          <AddFactForm />
        </div>

        {groups.length === 0 ? (
          <p className="mt-8 text-ink-muted">Nothing yet. As you talk with your advisors, the things worth keeping land here.</p>
        ) : (
          groups.map((g) => (
            <div key={g.value} className="mt-8">
              <h3 className="eyebrow">{g.label}</h3>
              <ul className="mt-1">
                {g.facts.map((f) => (
                  <MemoryFactRow key={f.id} fact={f} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {/* 4. Conversation summaries */}
      <section className="mt-12 border-t border-line pt-8 pb-8" aria-labelledby="summaries-heading">
        <h2 id="summaries-heading" className="font-display text-2xl">
          Conversation summaries
        </h2>
        <p className="mt-2 text-sm text-ink-soft">Longer conversations are condensed so months of history stay useful to your advisors.</p>

        {summaries.length === 0 ? (
          <p className="mt-6 text-ink-muted">No summaries yet. They appear once a conversation has run long enough to need one.</p>
        ) : (
          <div className="mt-4">
            {summaries.map((c) => (
              <details key={c.id} className="group border-b border-line-soft py-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block truncate font-display text-lg leading-snug">{c.title}</span>
                    <span className="block text-xs text-ink-muted">
                      {c.advisor.name}, {dateFormat.format(c.updatedAt)}
                    </span>
                  </span>
                  <span className="eyebrow shrink-0 group-open:hidden">Read</span>
                  <span className="eyebrow hidden shrink-0 group-open:inline">Close</span>
                </summary>
                <p className="mt-3 whitespace-pre-wrap break-words leading-relaxed text-ink-soft">{c.summary}</p>
                <Link href={`/chat/${c.advisor.slug}/${c.id}`} className="mt-1 inline-flex min-h-11 items-center text-sm text-sage underline underline-offset-4">
                  Open the conversation
                </Link>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
