import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cached: ReturnType<typeof createAnthropic> | null = null;

export function anthropic() {
  if (!cached) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    cached = createAnthropic({ apiKey });
  }
  return cached;
}

/** The model used for cheap background jobs: memory extraction and summaries. */
export const UTILITY_MODEL = "claude-haiku-4-5-20251001";
