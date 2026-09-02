import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { currentPeriod } from "@/lib/usage";
import { PageHeader, Section, Stat, StatGrid, Table, Th, Td, Pill, Empty, TextLink } from "@/components/admin/ui";
import { formatDateTime, formatMoney, formatNumber, monthStart, periodLabel, previewJson } from "@/components/admin/format";

export const metadata: Metadata = { title: "Overview" };

const INTEGRATIONS = [
  { label: "Anthropic", env: "ANTHROPIC_API_KEY", what: "Powers every advisor. Without it the chat answers with a holding message and a 503." },
  { label: "Voyage", env: "VOYAGE_API_KEY", what: "Embeds the knowledge library so advisors can search it. Without it documents chunk but wait to embed." },
  { label: "Resend", env: "RESEND_API_KEY", what: "Sends sign in, set password and reset emails. Without it every email prints to the server log." },
  { label: "Kajabi webhook", env: "KAJABI_WEBHOOK_SECRET", what: "Lets Kajabi purchases grant access. Without it the webhook refuses every call." },
] as const;

export default async function AdminOverviewPage() {
  await requireAdmin();
  const period = currentPeriod();
  const since = monthStart();
  const activeWhere = { status: "ACTIVE" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };

  const [subscriberGroups, totalUsers, conversations, messages, totalCost, perAdvisor, advisors, audit, kajabi] = await Promise.all([
    db.entitlement.groupBy({ by: ["userId"], where: activeWhere }),
    db.user.count(),
    db.conversation.count({ where: { createdAt: { gte: since } } }),
    db.message.count({ where: { createdAt: { gte: since } } }),
    db.usageLedger.aggregate({ where: { period, advisorId: null }, _sum: { costMicros: true, requests: true } }),
    db.usageLedger.groupBy({ by: ["advisorId"], where: { period, advisorId: { not: null } }, _sum: { costMicros: true, requests: true, tokensIn: true, tokensOut: true } }),
    db.advisor.findMany({ select: { id: true, name: true, slug: true }, orderBy: { sortOrder: "asc" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { email: true, name: true } } } }),
    db.kajabiEvent.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const advisorName = new Map(advisors.map((a) => [a.id, a.name]));
  const costRows = perAdvisor
    .map((r) => ({ id: r.advisorId ?? "", name: advisorName.get(r.advisorId ?? "") ?? "Removed advisor", cost: r._sum.costMicros ?? BigInt(0), requests: r._sum.requests ?? 0, tokens: (r._sum.tokensIn ?? 0) + (r._sum.tokensOut ?? 0) }))
    .sort((a, b) => Number(b.cost - a.cost));

  return (
    <>
      <PageHeader eyebrow="Overview" title="The house at a glance" description={`Counts and cost for ${periodLabel(period)}. Figures are estimates from token usage, not the provider invoice.`} />

      <Section title="This month">
        <StatGrid>
          <Stat label="Subscribers" value={formatNumber(subscriberGroups.length)} hint="People with at least one active entitlement" />
          <Stat label="Users" value={formatNumber(totalUsers)} hint="Every account, including admins" />
          <Stat label="Conversations" value={formatNumber(conversations)} hint="Started this month" />
          <Stat label="Messages" value={formatNumber(messages)} hint="Sent and answered this month" />
        </StatGrid>
      </Section>

      <Section title="Estimated cost" description="Summed from the usage ledger at the prices in Settings. Input and output tokens both count.">
        <StatGrid>
          <Stat label="All advisors" value={formatMoney(totalCost._sum.costMicros)} hint={`${formatNumber(totalCost._sum.requests)} requests`} />
        </StatGrid>
        <div className="mt-4">
          {costRows.length === 0 ? (
            <Empty>No usage recorded yet this month.</Empty>
          ) : (
            <Table minWidth="32rem" caption="Cost per advisor this month">
              <thead>
                <tr>
                  <Th>Advisor</Th>
                  <Th align="right">Requests</Th>
                  <Th align="right">Tokens</Th>
                  <Th align="right">Estimated cost</Th>
                </tr>
              </thead>
              <tbody>
                {costRows.map((r) => (
                  <tr key={r.id}>
                    <Td>{r.name}</Td>
                    <Td align="right">{formatNumber(r.requests)}</Td>
                    <Td align="right">{formatNumber(r.tokens)}</Td>
                    <Td align="right">{formatMoney(r.cost)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </Section>

      <Section title="Integrations" description="Read from the server environment. Same checks as /api/health.">
        <div className="card divide-y divide-line-soft">
          {INTEGRATIONS.map((i) => {
            const on = Boolean(process.env[i.env]);
            return (
              <div key={i.env} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-ink">
                    {i.label} <span className="ml-1 font-mono text-xs text-ink-muted">{i.env}</span>
                  </div>
                  <div className="text-xs leading-relaxed text-ink-muted">{i.what}</div>
                </div>
                <div className="shrink-0">
                  <Pill tone={on ? "ok" : "danger"}>{on ? "Connected" : "Not connected"}</Pill>
                </div>
              </div>
            );
          })}
          <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="text-sm text-ink">
              Database <span className="ml-1 font-mono text-xs text-ink-muted">DATABASE_URL</span>
            </div>
            <Pill tone="ok">Connected</Pill>
          </div>
        </div>
      </Section>

      <Section title="Recent admin activity" description="The last ten changes made from this screen." actions={<TextLink href="/admin/users">Users</TextLink>}>
        {audit.length === 0 ? (
          <Empty>Nothing yet. Every grant, revoke and edit will be listed here.</Empty>
        ) : (
          <Table minWidth="44rem" caption="Recent audit log">
            <thead>
              <tr>
                <Th>When (UTC)</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>Target</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <Td muted className="whitespace-nowrap">{formatDateTime(a.createdAt)}</Td>
                  <Td>{a.actor?.name ?? a.actor?.email ?? "System"}</Td>
                  <Td className="font-mono text-xs">{a.action}</Td>
                  <Td muted className="font-mono text-xs">
                    {a.targetType}
                    {a.targetId ? ` ${a.targetId.slice(0, 10)}` : ""}
                  </Td>
                  <Td muted className="max-w-[18rem] break-words font-mono text-xs">{previewJson(a.meta)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Recent Kajabi events" description="The last ten webhook calls. Errors are highlighted." actions={<TextLink href="/admin/kajabi">Full log and replay</TextLink>}>
        {kajabi.length === 0 ? (
          <Empty>No webhook calls received yet. Connect Kajabi from the Kajabi tab.</Empty>
        ) : (
          <Table minWidth="44rem" caption="Recent Kajabi events">
            <thead>
              <tr>
                <Th>When (UTC)</Th>
                <Th>Event</Th>
                <Th>Email</Th>
                <Th>Offer</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {kajabi.map((e) => (
                <tr key={e.id} className={e.error ? "bg-danger-soft" : ""}>
                  <Td muted className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                  <Td className="font-mono text-xs">{e.eventType}</Td>
                  <Td>{e.memberEmail ?? <span className="text-ink-muted">none</span>}</Td>
                  <Td className="font-mono text-xs">{e.offerId ?? <span className="text-ink-muted">none</span>}</Td>
                  <Td>{e.error ? <span className="text-danger">{e.error}</span> : e.processedAt ? <Pill tone="ok">Processed</Pill> : <Pill tone="warn">Unprocessed</Pill>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </>
  );
}
