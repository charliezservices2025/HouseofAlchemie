import "server-only";
import { db } from "@/lib/db";
import type { Advisor } from "@/generated/prisma/client";
import type { UsageSnapshot } from "@/lib/usage";
import type { ChatAdvisor, ChatMessage, ChatUsage, FirstMeeting } from "./types";
import { hasAnswered, parseAdvisorQuestions, readAdvisorIntakes, recentlySkipped } from "./questions";

export function toChatAdvisor(a: Advisor): ChatAdvisor {
  return { slug: a.slug, name: a.name, title: a.title, tagline: a.tagline, accentColor: a.accentColor };
}

export function toChatUsage(u: UsageSnapshot): ChatUsage {
  const [y, m] = u.period.split("-").map(Number);
  // Periods are one based, so month index m is already the month after this one.
  const resetsOn = new Date(Date.UTC(y, m, 1));
  const resetLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }).format(resetsOn);
  return { percent: u.percent, warn: u.warn, overCap: u.overCap, resetLabel };
}

/** Null when the advisor has no questions, they are already answered, or the subscriber skipped this week. */
export async function loadFirstMeeting(userId: string, advisor: Advisor): Promise<FirstMeeting | null> {
  const questions = parseAdvisorQuestions(advisor.onboardingQuestions);
  if (questions.length === 0) return null;
  const profile = await db.profile.findUnique({ where: { userId }, select: { advisorIntakes: true } });
  const intake = readAdvisorIntakes(profile?.advisorIntakes)[advisor.slug];
  if (hasAnswered(intake, questions) || recentlySkipped(intake)) return null;
  return { questions };
}

function citationTitles(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const titles: string[] = [];
  for (const c of raw) {
    const t = c && typeof c === "object" ? (c as { documentTitle?: unknown }).documentTitle : undefined;
    if (typeof t === "string" && t.trim() && !titles.includes(t)) titles.push(t);
  }
  return titles.length ? titles : undefined;
}

/** The conversation, scoped to its owner and advisor, with messages as UIMessages. Null when it is not theirs. */
export async function loadConversation(userId: string, advisorId: string, conversationId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, userId, advisorId },
    select: {
      id: true,
      title: true,
      messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, citations: true } },
    },
  });
  if (!conversation) return null;
  const messages: ChatMessage[] = conversation.messages.map((m) => {
    const citations = m.role === "ASSISTANT" ? citationTitles(m.citations) : undefined;
    return {
      id: m.id,
      role: m.role === "USER" ? "user" : "assistant",
      parts: [{ type: "text", text: m.content }],
      ...(citations ? { metadata: { citations } } : {}),
    };
  });
  return { id: conversation.id, title: conversation.title, messages };
}
