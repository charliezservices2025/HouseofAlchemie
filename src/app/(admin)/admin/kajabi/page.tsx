import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { replayKajabiEvent } from "@/app/(admin)/admin/actions";
import { ActionButton } from "@/components/admin/action-form";
import { CopyButton } from "@/components/admin/copy-button";
import { PageHeader, Section, Table, Th, Td, Pill, Empty, Notice, FilterChips, TextLink } from "@/components/admin/ui";
import { formatDateTime, previewJson } from "@/components/admin/format";

export const metadata: Metadata = { title: "Kajabi" };

type Filter = "all" | "errors" | "unprocessed";

export default async function AdminKajabiPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { filter: raw } = await searchParams;
  const filter: Filter = raw === "errors" || raw === "unprocessed" ? raw : "all";

  const secret = process.env.KAJABI_WEBHOOK_SECRET;
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const webhookUrl = secret ? `${appUrl}/api/kajabi/webhook?token=${encodeURIComponent(secret)}` : null;

  const where = filter === "errors" ? { error: { not: null } } : filter === "unprocessed" ? { processedAt: null } : {};
  const [events, counts] = await Promise.all([
    db.kajabiEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
    Promise.all([db.kajabiEvent.count(), db.kajabiEvent.count({ where: { error: { not: null } } }), db.kajabiEvent.count({ where: { processedAt: null } })]),
  ]);
  const [all, errors, unprocessed] = counts;

  return (
    <>
      <PageHeader eyebrow="Kajabi" title="Purchases become access" description="Kajabi calls this app when someone buys or cancels. Every call is kept, so anything that went wrong can be fixed and replayed." />

      <Section title="Connect Kajabi">
        {webhookUrl ? (
          <div className="card p-4 sm:p-6">
            <div className="eyebrow mb-2">Webhook URL</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <code className="min-w-0 flex-1 break-all border border-line bg-cream px-3 py-2.5 font-mono text-xs leading-relaxed text-ink">{webhookUrl}</code>
              <CopyButton value={webhookUrl} label="Copy URL" />
            </div>
            <p className="mt-2 text-xs text-ink-muted">This URL contains the secret. Only admins can see this page. Do not paste it anywhere except Kajabi.</p>
            <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>In Kajabi, open Settings, then Integrations, then Webhooks, and add a new webhook with the URL above.</li>
              <li>Turn on the purchase and cancellation events for offers. Kajabi sends the member email and the offer id; this app matches the offer id to an advisor or suite.</li>
              <li>
                Paste each offer id into the matching advisor or suite. Every plan includes Evren, so every specialist offer id goes on Evren too. <TextLink href="/admin/advisors">Open advisors</TextLink>
              </li>
            </ol>
          </div>
        ) : (
          <Notice tone="danger" role="alert">
            KAJABI_WEBHOOK_SECRET is not set on the server, so the webhook refuses every call. Add a long random value to the environment, redeploy, and the URL will appear here.
          </Notice>
        )}
      </Section>

      <Section title="Event log" description="Newest first, up to 100. Replay runs the stored payload through the same code the webhook uses, so a purchase that arrived before its offer was mapped can be granted now.">
        <div className="mb-4">
          <FilterChips
            label="Filter events"
            items={[
              { href: "/admin/kajabi", label: "All", active: filter === "all", count: all },
              { href: "/admin/kajabi?filter=errors", label: "Errors", active: filter === "errors", count: errors },
              { href: "/admin/kajabi?filter=unprocessed", label: "Unprocessed", active: filter === "unprocessed", count: unprocessed },
            ]}
          />
        </div>

        {events.length === 0 ? (
          <Empty>{filter === "all" ? "No webhook calls yet." : filter === "errors" ? "No errors. Every event was applied." : "Nothing waiting."}</Empty>
        ) : (
          <Table minWidth="60rem" caption="Kajabi events">
            <thead>
              <tr>
                <Th>When (UTC)</Th>
                <Th>Event</Th>
                <Th>Email</Th>
                <Th>Offer</Th>
                <Th>Result</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const unmapped = Boolean(e.error && e.error.includes("not mapped"));
                return (
                  <tr key={e.id} className={e.error ? "bg-danger-soft" : ""}>
                    <Td muted className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                    <Td className="font-mono text-xs">{e.eventType}</Td>
                    <Td>{e.memberEmail ?? <span className="text-ink-muted">none found</span>}</Td>
                    <Td className="font-mono text-xs">{e.offerId ?? <span className="text-ink-muted">none found</span>}</Td>
                    <Td className="max-w-[20rem]">
                      {e.error ? (
                        <span className="text-danger">{e.error}</span>
                      ) : e.processedAt ? (
                        <span className="flex flex-col gap-1">
                          <Pill tone="ok">Processed</Pill>
                          <span className="text-xs text-ink-muted">{formatDateTime(e.processedAt)}</span>
                        </span>
                      ) : (
                        <Pill tone="warn">Unprocessed</Pill>
                      )}
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-ink-muted">Payload</summary>
                        <pre className="mt-1 max-h-48 max-w-[20rem] overflow-auto bg-cream p-2 font-mono text-[0.6875rem] leading-relaxed text-ink-soft">{previewJson(e.payload, 2000)}</pre>
                      </details>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-2">
                        <ActionButton action={replayKajabiEvent} label="Replay" pendingLabel="Replaying" hidden={{ eventId: e.id }} />
                        {unmapped && <TextLink href="/admin/advisors">Map this offer</TextLink>}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
