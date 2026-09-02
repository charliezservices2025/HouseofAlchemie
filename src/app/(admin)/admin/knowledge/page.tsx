import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { deleteKnowledgeDocument, reingestKnowledgeDocument } from "@/app/(admin)/admin/actions";
import { ActionButton } from "@/components/admin/action-form";
import { KnowledgeAddForm } from "@/components/admin/knowledge-add-form";
import { PageHeader, Section, Table, Th, Td, Pill, Empty, Notice } from "@/components/admin/ui";
import { formatDateTime, formatNumber } from "@/components/admin/format";

export const metadata: Metadata = { title: "Knowledge" };

function statusPill(status: "PENDING" | "PROCESSING" | "READY" | "FAILED") {
  switch (status) {
    case "READY":
      return <Pill tone="ok">Ready</Pill>;
    case "FAILED":
      return <Pill tone="danger">Failed</Pill>;
    case "PROCESSING":
      return <Pill tone="warn">Processing</Pill>;
    default:
      return <Pill tone="warn">Waiting</Pill>;
  }
}

export default async function AdminKnowledgePage() {
  await requireAdmin();
  const [docs, advisors] = await Promise.all([
    db.knowledgeDocument.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, sourceName: true, advisorScope: true, status: true, chunkCount: true, error: true, createdAt: true, updatedAt: true } }),
    db.advisor.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  const nameFor = new Map(advisors.map((a) => [a.slug, a.name]));
  const embeddingsOn = Boolean(process.env.VOYAGE_API_KEY);
  const ready = docs.filter((d) => d.status === "READY").length;

  return (
    <>
      <PageHeader eyebrow="Knowledge" title="Erica's frameworks" description="Material the advisors search before they answer. Each document is split into passages; the passages an answer draws on are cited back to the title." />

      {!embeddingsOn && (
        <div className="mb-6">
          <Notice tone="warn">
            VOYAGE_API_KEY is not set, so new material is split into passages but not embedded, and the advisors cannot search it yet. Once the key is added, use Re-ingest on each document to finish.
          </Notice>
        </div>
      )}

      <Section title="Add material">
        <div className="card p-4 sm:p-6">
          <KnowledgeAddForm advisors={advisors} />
        </div>
      </Section>

      <Section title="Library" description={docs.length ? `${formatNumber(docs.length)} document${docs.length === 1 ? "" : "s"}, ${formatNumber(ready)} searchable.` : undefined}>
        {docs.length === 0 ? (
          <Empty>Nothing in the library yet. Add the first framework above.</Empty>
        ) : (
          <Table minWidth="56rem" caption="Knowledge documents">
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Status</Th>
                <Th align="right">Passages</Th>
                <Th>Advisors</Th>
                <Th>Updated (UTC)</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <Link href={`/admin/knowledge/${d.id}`} className="py-3 text-ink underline decoration-line underline-offset-4 hover:text-sage">
                      {d.title}
                    </Link>
                    <div className="text-xs text-ink-muted">{d.sourceName}</div>
                  </Td>
                  <Td>
                    {statusPill(d.status)}
                    {d.error && <div className={`mt-1 max-w-[16rem] text-xs ${d.status === "FAILED" ? "text-danger" : "text-ink-muted"}`}>{d.error}</div>}
                  </Td>
                  <Td align="right">{formatNumber(d.chunkCount)}</Td>
                  <Td>{d.advisorScope.length === 0 ? <span className="text-ink-muted">All</span> : d.advisorScope.map((s) => nameFor.get(s) ?? s).join(", ")}</Td>
                  <Td muted className="whitespace-nowrap">{formatDateTime(d.updatedAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton action={reingestKnowledgeDocument} label="Re-ingest" pendingLabel="Processing" hidden={{ documentId: d.id }} />
                      <ActionButton action={deleteKnowledgeDocument} label="Delete" pendingLabel="Deleting" confirm={`Delete "${d.title}" and its ${d.chunkCount} passages? This cannot be undone.`} hidden={{ documentId: d.id }} variant="btn btn-secondary text-danger border-danger" />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
