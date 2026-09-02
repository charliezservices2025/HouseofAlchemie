import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { embedQuery, embeddingsConfigured, toVectorLiteral } from "./embed";
import type { RetrievedPassage } from "@/lib/ai/prompt";

/**
 * Finds the framework passages most relevant to a question, limited to
 * documents in scope for this advisor (or scoped to everyone). Returns
 * nothing, quietly, when embeddings are not configured or the library is
 * empty, so the advisor still answers from her own prompt.
 */
export async function searchKnowledge(query: string, advisorSlug: string, limit = 6): Promise<RetrievedPassage[]> {
  if (!embeddingsConfigured()) return [];
  const ready = await db.knowledgeDocument.count({ where: { status: "READY" } });
  if (ready === 0) return [];

  let vector: number[];
  try {
    vector = await embedQuery(query.slice(0, 4000));
  } catch {
    return [];
  }
  if (!vector.length) return [];

  const literal = toVectorLiteral(vector);
  const rows = await db.$queryRaw<Array<{ id: string; documentId: string; title: string; content: string; distance: number }>>(Prisma.sql`
    SELECT c.id, c."documentId", d.title, c.content, (c.embedding <=> ${literal}::vector) AS distance
    FROM "KnowledgeChunk" c
    JOIN "KnowledgeDocument" d ON d.id = c."documentId"
    WHERE d.status = 'READY'
      AND c.embedding IS NOT NULL
      AND (cardinality(d."advisorScope") = 0 OR ${advisorSlug} = ANY(d."advisorScope"))
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${limit}
  `);

  // Cosine distance below 0.55 is a confident match for voyage-3-large.
  return rows
    .filter((r) => r.distance < 0.55)
    .map((r) => ({ chunkId: r.id, documentId: r.documentId, documentTitle: r.title, content: r.content }));
}
