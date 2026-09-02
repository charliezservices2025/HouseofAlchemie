import "server-only";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { anthropic, aiConfigured, UTILITY_MODEL } from "./client";
import { getSetting } from "@/lib/settings";
import type { MemoryCategory } from "@/generated/prisma/client";

const CATEGORIES = ["CLIENT", "OFFER", "LAUNCH", "POSITIONING", "GOAL", "BLOCKER", "PREFERENCE", "OTHER"] as const;

const extractSchema = z.object({
  facts: z
    .array(
      z.object({
        category: z.enum(CATEGORIES),
        content: z.string().min(8).max(280),
      }),
    )
    .max(8),
});

/**
 * After an exchange, pull out durable facts about the subscriber's business
 * and store them as structured memory. Runs on the cheap model, in the
 * background, and never blocks the reply. Duplicates are skipped by simple
 * normalised comparison so the memory screen stays readable.
 */
export async function extractMemories(args: { userId: string; conversationId: string; userText: string; assistantText: string }) {
  if (!aiConfigured()) return;

  const existing = await db.memoryFact.findMany({
    where: { userId: args.userId, archivedAt: null },
    select: { content: true },
    take: 200,
  });
  const seen = new Set(existing.map((m) => normalise(m.content)));

  let facts: z.infer<typeof extractSchema>["facts"] = [];
  try {
    const { object } = await generateObject({
      model: anthropic()(UTILITY_MODEL),
      schema: extractSchema,
      system:
        "You maintain a structured memory of a business owner's situation for a team of advisors. Extract only durable, specific facts the client stated about their own business: clients, offers, prices, launches, positioning, goals, blockers, preferences. Ignore the advisor's advice, ignore speculation, ignore anything already obvious. Write each fact as one plain sentence in third person, present tense, no em dashes. If there is nothing new, return an empty list.",
      prompt: `Client said:\n${args.userText}\n\nAdvisor replied:\n${args.assistantText}\n\nAlready remembered (do not repeat):\n${existing.map((e) => `- ${e.content}`).join("\n") || "(nothing)"}`,
    });
    facts = object.facts;
  } catch {
    return;
  }

  const fresh = facts.filter((f) => !seen.has(normalise(f.content)));
  if (!fresh.length) return;

  await db.memoryFact.createMany({
    data: fresh.map((f) => ({
      userId: args.userId,
      category: f.category as MemoryCategory,
      content: f.content.replace(/[–—]/g, ",").trim(),
      source: args.conversationId,
    })),
  });
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Rolling summary so months of history stay usable inside a prompt. When a
 * conversation grows past the threshold, the older messages are folded into
 * the conversation summary and only recent turns are sent verbatim.
 */
export async function maybeSummariseConversation(conversationId: string) {
  if (!aiConfigured()) return;
  const threshold = await getSetting("chat.summarizeAfterMessages");
  const convo = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!convo || convo.messages.length < threshold) return;

  const keep = 10;
  const older = convo.messages.slice(0, convo.messages.length - keep);
  if (older.length < 6) return;

  const transcript = older.map((m) => `${m.role === "USER" ? "Client" : "Advisor"}: ${m.content}`).join("\n\n");
  try {
    const { text } = await generateText({
      model: anthropic()(UTILITY_MODEL),
      system: "Summarise this advisory conversation for the advisor's own memory. Keep decisions, numbers, names, commitments and open questions. Third person. Under 250 words. No em dashes.",
      prompt: `${convo.summary ? `Earlier summary:\n${convo.summary}\n\nNew messages:\n` : ""}${transcript}`,
    });
    await db.conversation.update({ where: { id: conversationId }, data: { summary: text.trim() } });
  } catch {
    // A failed summary is harmless. The full history is still in the database.
  }
}

/** Auto title a new conversation from its first exchange. */
export async function titleConversation(conversationId: string, firstUserMessage: string) {
  if (!aiConfigured()) return;
  try {
    const { text } = await generateText({
      model: anthropic()(UTILITY_MODEL),
      system: "Write a title of at most six words for this conversation, in sentence case, no quotes, no punctuation at the end, no em dashes.",
      prompt: firstUserMessage.slice(0, 600),
    });
    const title = text.trim().replace(/^["']|["']$/g, "").slice(0, 80);
    if (title) await db.conversation.update({ where: { id: conversationId }, data: { title } });
  } catch {
    // keep the default title
  }
}
