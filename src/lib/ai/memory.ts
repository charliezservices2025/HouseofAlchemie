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
        "You maintain a structured memory of a business owner's situation for a team of advisors. Extract only durable, specific facts the owner stated about their own business: their clients, offers, prices, launches, positioning, goals, blockers, preferences. Ignore the advisor's advice, ignore speculation, ignore anything already obvious. Write each fact as one plain sentence in third person, present tense, referring to the business owner as \"the owner\" (never \"the client\", because their customers are called clients), no em dashes. If there is nothing new, return an empty list.",
      prompt: `The owner said:\n${args.userText}\n\nAdvisor replied:\n${args.assistantText}\n\nAlready remembered (do not repeat):\n${existing.map((e) => `- ${e.content}`).join("\n") || "(nothing)"}`,
    });
    facts = object.facts;
  } catch (err) {
    console.error("[memory] extraction failed:", err instanceof Error ? err.message : err);
    return;
  }

  const fresh = facts.filter((f) => !seen.has(normalise(f.content)));
  if (!fresh.length) return;

  await db.memoryFact.createMany({
    data: fresh.map((f) => ({
      userId: args.userId,
      category: f.category as MemoryCategory,
      content: f.content.replace(/[\u2013\u2014]/g, ",").trim(),
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
  } catch (err) {
    // A failed summary is harmless. The full history is still in the database.
    console.error("[memory] summary failed:", err instanceof Error ? err.message : err);
  }
}

/** A safe title when the model does not behave: the first few words of the question. */
function fallbackTitle(message: string): string {
  const words = message.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ");
  const clean = words.replace(/[.,;:!?"'()]+$/g, "");
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "New conversation";
}

function looksLikeTitle(s: string): boolean {
  if (!s || s.length > 60) return false;
  if (/[\n"“”]/.test(s)) return false;
  if (s.split(/\s+/).length > 8) return false;
  if (/^(i |i'm|i’m|sorry|as an|the client|you )/i.test(s)) return false;
  if (/[.!?]$/.test(s)) return false;
  return true;
}

/** Auto title a new conversation from its first exchange. */
export async function titleConversation(conversationId: string, firstUserMessage: string) {
  if (!aiConfigured()) return;
  let title = "";
  try {
    const { object } = await generateObject({
      model: anthropic()(UTILITY_MODEL),
      schema: z.object({ title: z.string().min(2).max(60) }),
      system:
        "You label conversations for a list view. Given the first message a business owner sent to an advisor, return a short label of two to six words describing the topic, in sentence case, with no quotes, no trailing punctuation and no em dashes. Do not answer the message. Do not comment on it. Only label it.",
      prompt: firstUserMessage.slice(0, 600),
    });
    title = object.title.trim().replace(/[\u2013\u2014]/g, "-").replace(/[.!?]+$/g, "");
  } catch (err) {
    console.error("[memory] title failed:", err instanceof Error ? err.message : err);
  }
  if (!looksLikeTitle(title)) title = fallbackTitle(firstUserMessage);
  await db.conversation.update({ where: { id: conversationId }, data: { title: title.slice(0, 80) } });
}
