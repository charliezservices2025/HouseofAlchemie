import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { chunkText, estimateTokens } from "./chunk";
import { embedDocuments, embeddingsConfigured, toVectorLiteral } from "./embed";

/**
 * Turns an uploaded document into searchable chunks. Chunks are always
 * written so the text is browsable in admin; embeddings are added when the
 * key is present, and the document is marked READY only when it can actually
 * be retrieved.
 */
export async function ingestDocument(documentId: string) {
  const doc = await db.knowledgeDocument.findUnique({ where: { id: documentId } });
  if (!doc) return;

  await db.knowledgeDocument.update({ where: { id: documentId }, data: { status: "PROCESSING", error: null } });

  try {
    const chunks = chunkText(doc.rawText);
    if (!chunks.length) throw new Error("No readable text in this document.");

    await db.knowledgeChunk.deleteMany({ where: { documentId } });
    await db.knowledgeChunk.createMany({
      data: chunks.map((content, ordinal) => ({ documentId, ordinal, content, tokenCount: estimateTokens(content) })),
    });

    if (!embeddingsConfigured()) {
      await db.knowledgeDocument.update({
        where: { id: documentId },
        data: { status: "PENDING", chunkCount: chunks.length, error: "Chunked. Waiting for VOYAGE_API_KEY to embed." },
      });
      return;
    }

    const vectors = await embedDocuments(chunks);
    const rows = await db.knowledgeChunk.findMany({ where: { documentId }, orderBy: { ordinal: "asc" }, select: { id: true, ordinal: true } });
    for (const row of rows) {
      const v = vectors[row.ordinal];
      if (!v || !v.length) continue;
      await db.$executeRaw(Prisma.sql`UPDATE "KnowledgeChunk" SET embedding = ${toVectorLiteral(v)}::vector WHERE id = ${row.id}`);
    }

    await db.knowledgeDocument.update({ where: { id: documentId }, data: { status: "READY", chunkCount: chunks.length, error: null } });
  } catch (err) {
    await db.knowledgeDocument.update({
      where: { id: documentId },
      data: { status: "FAILED", error: err instanceof Error ? err.message : "Ingest failed" },
    });
  }
}
