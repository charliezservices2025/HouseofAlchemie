import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { PageHeader, Section, Pill, Empty, KeyValue, TextLink, Notice } from "@/components/admin/ui";
import { formatDateTime, formatNumber } from "@/components/admin/format";

export const metadata: Metadata = { title: "Knowledge document" };

export default async function AdminKnowledgeDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const doc = await db.knowledgeDocument.findUnique({
    where: { id },
    select: { id: true, title: true, sourceName: true, advisorScope: true, status: true, chunkCount: true, error: true, createdAt: true, updatedAt: true, rawText: true, chunks: { orderBy: { ordinal: "asc" }, select: { id: true, ordinal: true, content: true, tokenCount: true } } },
  });
  if (!doc) notFound();

  // The vector column is Unsupported in Prisma, so count embedded rows with raw SQL.
  const embedded = await db.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*)::bigint AS count FROM "KnowledgeChunk" WHERE "documentId" = ${doc.id} AND embedding IS NOT NULL`;
  const embeddedCount = Number(embedded[0]?.count ?? 0);

  const advisors = await db.advisor.findMany({ where: { slug: { in: doc.advisorScope } }, select: { slug: true, name: true } });
  const nameFor = new Map(advisors.map((a) => [a.slug, a.name]));
  const tokens = doc.chunks.reduce((n, c) => n + c.tokenCount, 0);

  return (
    <>
      <div className="mb-2 text-sm">
        <TextLink href="/admin/knowledge">Library</TextLink>
      </div>
      <PageHeader
        eyebrow={doc.sourceName}
        title={doc.title}
        actions={doc.status === "READY" ? <Pill tone="ok">Ready</Pill> : doc.status === "FAILED" ? <Pill tone="danger">Failed</Pill> : <Pill tone="warn">Waiting</Pill>}
      />

      {doc.error && (
        <div className="mb-6">
          <Notice tone={doc.status === "FAILED" ? "danger" : "warn"}>{doc.error}</Notice>
        </div>
      )}

      <Section title="About this document">
        <KeyValue
          rows={[
            { label: "Advisors", value: doc.advisorScope.length === 0 ? "All advisors" : doc.advisorScope.map((s) => nameFor.get(s) ?? s).join(", ") },
            { label: "Passages", value: `${formatNumber(doc.chunkCount)}, ${formatNumber(embeddedCount)} embedded and searchable` },
            { label: "Size", value: `${formatNumber(doc.rawText.length)} characters, about ${formatNumber(tokens)} tokens` },
            { label: "Added", value: formatDateTime(doc.createdAt) },
            { label: "Updated", value: formatDateTime(doc.updatedAt) },
          ]}
        />
      </Section>

      <Section title="Passages" description="Exactly what an advisor can retrieve, in order. Passages overlap slightly so a step split across two is found from either side.">
        {doc.chunks.length === 0 ? (
          <Empty>No passages yet. Re-ingest the document from the library.</Empty>
        ) : (
          <ol className="flex flex-col gap-3">
            {doc.chunks.map((c) => (
              <li key={c.id} className="card p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                  <span className="eyebrow">Passage {c.ordinal + 1}</span>
                  <span>about {formatNumber(c.tokenCount)} tokens</span>
                  <span className="font-mono">{c.id}</span>
                </div>
                <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-ink">{c.content}</p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
