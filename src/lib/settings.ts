import { db } from "@/lib/db";

export type IntakeQuestion = {
  id: string;
  question: string;
  placeholder?: string;
  required?: boolean;
};

export type ModelPricing = {
  /** Dollars per million input tokens */
  inputPerMillion: number;
  /** Dollars per million output tokens */
  outputPerMillion: number;
};

/**
 * Editable settings with safe defaults. Erica changes these in Admin without
 * a developer. Keys are strings so new settings can be added without a
 * migration.
 */
export const DEFAULTS = {
  "intake.questions": [
    { id: "sells", question: "What does your business actually sell, and to whom?", placeholder: "Be specific. Who pays you, and for what?", required: true },
    { id: "ninety", question: "What are you working toward in the next ninety days?", placeholder: "One or two outcomes, not a wish list.", required: true },
    { id: "tried", question: "What have you already tried that did not work?", placeholder: "Offers, launches, pricing, platforms." },
    { id: "avoiding", question: "What is the thing you are avoiding?", placeholder: "The honest answer is the useful one." },
    { id: "clients", question: "Who are your best clients right now, and what do they have in common?" },
    { id: "price", question: "What do you charge, and how do you feel about that number?" },
    { id: "voice", question: "How would a happy client describe working with you?" },
    { id: "lifestyle", question: "What does the life you are building this business for look like?" },
  ] as IntakeQuestion[],

  "usage.pricing": {
    "claude-sonnet-5": { inputPerMillion: 3, outputPerMillion: 15 },
    "claude-opus-5": { inputPerMillion: 15, outputPerMillion: 75 },
    "claude-haiku-4-5-20251001": { inputPerMillion: 1, outputPerMillion: 5 },
  } as Record<string, ModelPricing>,

  "usage.warnAtPercent": 80,

  "chat.maxHistoryMessages": 30,
  "chat.summarizeAfterMessages": 24,

  "brand.appName": "House of Alchemie",
  "brand.supportEmail": "hello@houseofalchemie.ai",
  "brand.kajabiLibraryUrl": "https://www.houseofalchemie.ai/library",
  "brand.salesUrl": "https://www.houseofalchemie.ai/",
} as const;

export type SettingKey = keyof typeof DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof DEFAULTS)[K];

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return DEFAULTS[key];
  return row.value as SettingValue<K>;
}

export async function getSettings<K extends SettingKey>(keys: K[]): Promise<{ [P in K]: SettingValue<P> }> {
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as { [P in K]: SettingValue<P> };
  for (const k of keys) {
    out[k] = (map.has(k) ? map.get(k) : DEFAULTS[k]) as SettingValue<K>;
  }
  return out;
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingValue<K>) {
  await db.setting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}
