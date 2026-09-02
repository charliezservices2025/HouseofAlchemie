import type { Advisor, MemoryFact } from "@/generated/prisma/client";
import type { IntakeQuestion } from "@/lib/settings";

export type RetrievedPassage = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
};

export type PromptContext = {
  advisor: Advisor;
  subscriberName: string | null;
  intakeQuestions: IntakeQuestion[];
  intake: Record<string, string>;
  advisorIntake: Record<string, string>;
  advisorQuestions: IntakeQuestion[];
  memories: MemoryFact[];
  summary: string | null;
  passages: RetrievedPassage[];
  today: Date;
};

function block(title: string, body: string) {
  return `\n\n## ${title}\n${body.trim()}`;
}

function answered(questions: IntakeQuestion[], answers: Record<string, string>) {
  const lines: string[] = [];
  for (const q of questions) {
    const a = answers[q.id]?.trim();
    if (a) lines.push(`- ${q.question}\n  ${a}`);
  }
  return lines;
}

/**
 * Layers, in order of authority:
 *   1. Who this advisor is and how she speaks (from the registry)
 *   2. What she must never say
 *   3. The instruction hierarchy: Erica's frameworks outrank general knowledge
 *   4. Everything the team knows about this subscriber
 *   5. Framework passages retrieved for this specific question
 *   6. House formatting rules
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const { advisor } = ctx;
  const parts: string[] = [];

  parts.push(`You are ${advisor.name}, ${advisor.title}, an AI business advisor inside House of Alchemie, a private platform for luxury service entrepreneurs created by Erica Powell. ${advisor.tagline}`);
  parts.push(block("Who you are and how you work", advisor.systemPrompt));

  if (advisor.neverSay.length > 0) {
    parts.push(block("Never", advisor.neverSay.map((n) => `- ${n}`).join("\n")));
  }

  parts.push(
    block(
      "Where your answers come from",
      `Erica's own frameworks, sequence and terminology come first. Where the framework passages below cover the question, answer from them, use her language rather than a generic version, and say which material it came from in a short parenthetical such as (from Erica's Priceless Clients framework). Do not substitute a standard approach for hers.
When her material does not cover something, you may draw on general business knowledge, and you say so plainly in one short clause, for example "this next part goes beyond Erica's frameworks". Never quietly fill a gap and let the client assume it came from her.
You do not browse the internet and you do not claim to. You do not invent statistics, client results, or quotes.
You are a business advisor. You are not a lawyer, accountant, doctor or therapist. When a question needs one, say so kindly and stay in your lane.
Never promise or imply guaranteed earnings or results.`,
    ),
  );

  const known: string[] = [];
  if (ctx.subscriberName) known.push(`Name: ${ctx.subscriberName}`);
  const intakeLines = answered(ctx.intakeQuestions, ctx.intake);
  if (intakeLines.length) known.push(`What they told the House when they joined:\n${intakeLines.join("\n")}`);
  const advisorLines = answered(ctx.advisorQuestions, ctx.advisorIntake);
  if (advisorLines.length) known.push(`What they told you, ${advisor.name}, specifically:\n${advisorLines.join("\n")}`);
  const live = ctx.memories.filter((m) => !m.archivedAt);
  if (live.length) {
    const grouped = new Map<string, string[]>();
    for (const m of live) {
      const list = grouped.get(m.category) ?? [];
      list.push(m.content);
      grouped.set(m.category, list);
    }
    const lines: string[] = [];
    for (const [cat, items] of grouped) {
      lines.push(`${cat.charAt(0) + cat.slice(1).toLowerCase()}:`);
      for (const item of items) lines.push(`- ${item}`);
    }
    known.push(`What the team remembers:\n${lines.join("\n")}`);
  }
  if (ctx.summary) known.push(`Summary of earlier conversations:\n${ctx.summary}`);

  parts.push(
    block(
      "What you already know about this client",
      known.length
        ? `${known.join("\n\n")}\n\nUse this. Do not ask for things you already know. Do not recite it back unless it is useful. If something here seems out of date, ask one precise question rather than assuming.`
        : "Nothing yet. This is a first conversation. Ask one or two precise questions to orient yourself before advising, and do not interrogate.",
    ),
  );

  if (ctx.passages.length) {
    const body = ctx.passages
      .map((p, i) => `[${i + 1}] From "${p.documentTitle}":\n${p.content.trim()}`)
      .join("\n\n");
    parts.push(block("Erica's framework passages retrieved for this question", body));
  }

  parts.push(
    block(
      "How you write",
      `Warm, direct, specific, and unhurried. You sound like a trusted senior advisor who has done this many times, not like a chatbot and not like a cheerleader.
Lead with the answer. Then the reasoning. Then, if useful, the next step.
Use plain Markdown. Headings only when a reply is long enough to need them. Tables for anything with more than three comparable rows, such as plans, pricing ladders and timelines. Numbered steps for sequences. Short paragraphs.
Never use em dashes or en dashes. Use commas, full stops, colons or plain hyphens instead. This is a house rule with no exceptions.
No emoji. No exclamation marks in a row. No filler openers such as "Great question".
Keep answers as short as they can be while being complete. A useful two paragraph answer beats a thorough two page one.
Today's date is ${ctx.today.toISOString().slice(0, 10)}.`,
    ),
  );

  return parts.join("");
}
