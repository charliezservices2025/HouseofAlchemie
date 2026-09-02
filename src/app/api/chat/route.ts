import { after } from "next/server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { userFromRequest } from "@/lib/auth/current-user";
import { getUnlockedAdvisor } from "@/lib/entitlements";
import { getUsageSnapshot, recordUsage } from "@/lib/usage";
import { getSettings, type IntakeQuestion } from "@/lib/settings";
import { anthropic, aiConfigured } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { extractMemories, maybeSummariseConversation, titleConversation } from "@/lib/ai/memory";
import { searchKnowledge } from "@/lib/knowledge/search";

export const maxDuration = 60;

const bodySchema = z.object({
  advisorSlug: z.string().min(1).max(40),
  conversationId: z.string().min(1).max(60).optional(),
  messages: z.array(z.any()).min(1).max(200),
});

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    return m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
  }
  return "";
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request) {
  const user = await userFromRequest();
  if (!user) return json(401, { error: "Sign in to continue." });

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return json(400, { error: "Malformed request." });
  }
  const { advisorSlug, conversationId } = parsed;
  const uiMessages = parsed.messages as UIMessage[];

  const access = await getUnlockedAdvisor(user.id, advisorSlug);
  if (!access) return json(403, { error: "This advisor is not part of your plan yet." });
  const { advisor, monthlyTokenCap } = access;

  if (!aiConfigured()) {
    return json(503, { error: "Your advisor is not connected yet. Please check back soon.", code: "AI_NOT_CONFIGURED" });
  }

  const usage = await getUsageSnapshot(user.id, advisor.id, monthlyTokenCap);
  if (usage.overCap) {
    return json(429, {
      error: `You have used this month's allowance for ${advisor.name}. It resets on the first of next month.`,
      code: "OVER_CAP",
      usage,
    });
  }

  const text = lastUserText(uiMessages);
  if (!text) return json(400, { error: "Say something first." });
  if (text.length > 12000) return json(413, { error: "That message is very long. Try splitting it up." });

  // Find or create the conversation. The server, not the browser, owns history.
  let conversation = conversationId
    ? await db.conversation.findFirst({ where: { id: conversationId, userId: user.id, advisorId: advisor.id } })
    : null;
  const isFirstTurn = !conversation;
  if (!conversation) {
    conversation = await db.conversation.create({ data: { userId: user.id, advisorId: advisor.id } });
  }

  await db.message.create({ data: { conversationId: conversation.id, role: "USER", content: text } });

  const settings = await getSettings(["intake.questions", "chat.maxHistoryMessages"]);
  const [profile, memories, history, passages] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.memoryFact.findMany({ where: { userId: user.id, archivedAt: null }, orderBy: { createdAt: "asc" }, take: 80 }),
    db.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: settings["chat.maxHistoryMessages"],
    }),
    searchKnowledge(text, advisor.slug),
  ]);

  const intake = (profile?.intake ?? {}) as Record<string, string>;
  const advisorIntakes = (profile?.advisorIntakes ?? {}) as Record<string, Record<string, string>>;

  const system = buildSystemPrompt({
    advisor,
    subscriberName: user.name,
    intakeQuestions: settings["intake.questions"],
    intake,
    advisorQuestions: (advisor.onboardingQuestions as IntakeQuestion[]) ?? [],
    advisorIntake: advisorIntakes[advisor.slug] ?? {},
    memories,
    summary: conversation.summary,
    passages,
    today: new Date(),
  });

  const ordered = history.reverse();
  const modelMessages = await convertToModelMessages(
    ordered.map<UIMessage>((m) => ({
      id: m.id,
      role: m.role === "USER" ? "user" : "assistant",
      parts: [{ type: "text", text: m.content }],
    })),
  );

  const convoId = conversation.id;
  const result = streamText({
    model: anthropic()(advisor.model),
    system,
    messages: modelMessages,
    maxOutputTokens: 2000,
    // Persist inside onFinish so the answer is saved even if the client
    // disconnects mid stream.
    onFinish: async ({ text: answer, usage: u }) => {
      const tokensIn = u.inputTokens ?? 0;
      const tokensOut = u.outputTokens ?? 0;
      const clean = answer.replace(/[\u2013\u2014]/g, ",");
      try {
        await db.message.create({
          data: {
            conversationId: convoId,
            role: "ASSISTANT",
            content: clean,
            tokensIn,
            tokensOut,
            citations: passages.length ? passages.map((p) => ({ documentTitle: p.documentTitle, chunkId: p.chunkId })) : undefined,
          },
        });
        await db.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
        await recordUsage({ userId: user.id, advisorId: advisor.id, model: advisor.model, tokensIn, tokensOut });
      } catch (err) {
        // The reply has already streamed; a persistence failure must be loud in the logs, never silent.
        console.error("[chat] failed to persist reply or usage:", err instanceof Error ? err.message : err);
      }
    },
  });

  // Background work registered here, inside the request scope, and started
  // once the stream has fully completed. Memory extraction, the rolling
  // summary and the auto title never delay the reply.
  after(async () => {
    try {
      const answer = (await result.text).replace(/[\u2013\u2014]/g, ",");
      await Promise.allSettled([
        extractMemories({ userId: user.id, conversationId: convoId, userText: text, assistantText: answer }),
        maybeSummariseConversation(convoId),
        isFirstTurn ? titleConversation(convoId, text) : Promise.resolve(),
      ]);
    } catch (err) {
      console.error("[chat] background jobs failed:", err instanceof Error ? err.message : err);
    }
  });

  return result.toUIMessageStreamResponse({
    headers: { "x-conversation-id": conversation.id },
  });
}
