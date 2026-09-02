import "server-only";
import { VoyageAIClient } from "voyageai";

export const EMBEDDING_MODEL = "voyage-3-large";
export const EMBEDDING_DIMENSIONS = 1024;

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

let client: VoyageAIClient | null = null;
function voyage() {
  if (!client) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error("VOYAGE_API_KEY is not set");
    client = new VoyageAIClient({ apiKey });
  }
  return client;
}

/**
 * Voyage is Anthropic's recommended embedding partner. Documents and queries
 * use different input types so retrieval is asymmetric, which measurably
 * improves recall on question-to-passage search.
 */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const res = await voyage().embed({ input: batch, model: EMBEDDING_MODEL, inputType: "document" });
    for (const d of res.data ?? []) out.push(d.embedding ?? []);
  }
  return out;
}

export async function embedQuery(text: string): Promise<number[]> {
  const res = await voyage().embed({ input: [text], model: EMBEDDING_MODEL, inputType: "query" });
  return res.data?.[0]?.embedding ?? [];
}

export function toVectorLiteral(v: number[]): string {
  return `[${v.map((n) => (Number.isFinite(n) ? n.toFixed(6) : "0")).join(",")}]`;
}
