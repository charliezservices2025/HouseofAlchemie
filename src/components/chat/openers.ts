/**
 * Three ways in for a brand new conversation, in each advisor's lane.
 * Kept in code rather than the database because they are UI copy, not voice.
 */
const OPENERS: Record<string, [string, string, string]> = {
  evren: [
    "Help me name the one thing that matters this month.",
    "Here is what I sell and who buys it. Tell me what you see.",
    "I feel scattered. Where do I start?",
  ],
  lyra: [
    "Help me work out what I do that only I can do.",
    "Design a role I could hand off in the next ninety days.",
    "I want fewer hours without losing clients. Where is the leverage?",
  ],
  lumi: [
    "I flinch when I say my price. Help me understand why.",
    "Help me map where my revenue actually comes from.",
    "I am weighing a big decision. Think it through with me.",
  ],
  rune: [
    "A proposal has gone quiet. Help me write the follow up.",
    "Walk through my consultation with me and tell me where it drops.",
    "They said they need to think about it. What do I say next?",
  ],
  auren: [
    "Rewrite my bio so the right people recognise themselves.",
    "Plan a launch sequence for my next offer.",
    "Help me get specific about who my Priceless Client is.",
  ],
};

const FALLBACK: [string, string, string] = [
  "Here is where my business is right now.",
  "What should I focus on this month?",
  "Ask me what you need to know to help.",
];

export function openersFor(slug: string): [string, string, string] {
  return OPENERS[slug] ?? FALLBACK;
}
