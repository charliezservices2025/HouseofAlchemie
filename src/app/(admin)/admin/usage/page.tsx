import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getAdvisorAccess } from "@/lib/entitlements";
import { PageHeader, Section, Table, Th, Td, Empty, FilterChips, Stat, StatGrid } from "@/components/admin/ui";
import { formatMoney, formatNumber, isPeriod, percent, periodLabel, recentPeriods } from "@/components/admin/format";

export const metadata: Metadata = { title: "Usage" };

export default async function AdminUsagePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const periods = recentPeriods(6);
  const { period: raw } = await searchParams;
  const period = isPeriod(raw) && periods.includes(raw) ? raw : periods[0];

  const [perAdvisor, advisors, total, topRows] = await Promise.all([
    db.usageLedger.groupBy({ by: ["advisorId"], where: { period, advisorId: { not: null } }, _sum: { requests: true, tokensIn: true, tokensOut: true, costMicros: true } }),
    db.advisor.findMany({ select: { id: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } }),
    db.usageLedger.aggregate({ where: { period, advisorId: null }, _sum: { requests: true, tokensIn: true, tokensOut: true, costMicros: true }, _count: { userId: true } }),
    db.usageLedger.findMany({ where: { period, advisorId: null }, orderBy: { costMicros: "desc" }, take: 20, include: { user: { select: { id: true, email: true, name: true } } } }),
  ]);

  const advisorName = new Map(advisors.map((a) => [a.id, a.name]));
  const order = new Map(advisors.map((a) => [a.id, a.sortOrder]));
  const advisorRows = perAdvisor
    .map((r) => ({
      id: r.advisorId ?? "",
      name: advisorName.get(r.advisorId ?? "") ?? "Removed advisor",
      requests: r._sum.requests ?? 0,
      tokensIn: r._sum.tokensIn ?? 0,
      tokensOut: r._sum.tokensOut ?? 0,
      cost: r._sum.costMicros ?? BigInt(0),
    }))
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));

  // The cap is per advisor, so a subscriber's "cap percentage" is the highest
  // share used against any advisor they can open.
  const topUsers = await Promise.all(
    topRows.map(async (row) => {
      const [access, perAdvisorRows] = await Promise.all([
        getAdvisorAccess(row.userId),
        db.usageLedger.findMany({ where: { userId: row.userId, period, advisorId: { not: null } }, select: { advisorId: true, tokensIn: true, tokensOut: true } }),
      ]);
      const capFor = new Map(access.filter((a) => a.unlocked).map((a) => [a.advisor.id, { cap: a.monthlyTokenCap, name: a.advisor.name }]));
      let top: { pct: number; name: string } | null = null;
      for (const u of perAdvisorRows) {
        const entry = capFor.get(u.advisorId ?? "");
        if (!entry) continue;
        const pct = percent(u.tokensIn + u.tokensOut, entry.cap);
        if (!top || pct > top.pct) top = { pct, name: entry.name };
      }
      return { ...row, top };
    }),
  );

  return (
    <>
      <PageHeader eyebrow="Usage" title="Who is using what" description="Estimated from token counts at the prices in Settings. A subscriber's cap is per advisor, so the percentage shown is their highest." />

      <div className="mb-6">
        <FilterChips label="Choose a month" items={periods.map((p) => ({ href: p === periods[0] ? "/admin/usage" : `/admin/usage?period=${p}`, label: periodLabel(p), active: p === period }))} />
      </div>

      <Section title={periodLabel(period)}>
        <StatGrid>
          <Stat label="Estimated cost" value={formatMoney(total._sum.costMicros)} />
          <Stat label="Requests" value={formatNumber(total._sum.requests)} />
          <Stat label="Tokens" value={formatNumber((total._sum.tokensIn ?? 0) + (total._sum.tokensOut ?? 0))} hint={`${formatNumber(total._sum.tokensIn)} in, ${formatNumber(total._sum.tokensOut)} out`} />
          <Stat label="Active subscribers" value={formatNumber(total._count.userId)} hint="Sent at least one message" />
        </StatGrid>
      </Section>

      <Section title="By advisor">
        {advisorRows.length === 0 ? (
          <Empty>No usage in {periodLabel(period)}.</Empty>
        ) : (
          <Table minWidth="40rem" caption={`Usage by advisor in ${periodLabel(period)}`}>
            <thead>
              <tr>
                <Th>Advisor</Th>
                <Th align="right">Requests</Th>
                <Th align="right">Tokens in</Th>
                <Th align="right">Tokens out</Th>
                <Th align="right">Estimated cost</Th>
              </tr>
            </thead>
            <tbody>
              {advisorRows.map((r) => (
                <tr key={r.id}>
                  <Td>{r.name}</Td>
                  <Td align="right">{formatNumber(r.requests)}</Td>
                  <Td align="right">{formatNumber(r.tokensIn)}</Td>
                  <Td align="right">{formatNumber(r.tokensOut)}</Td>
                  <Td align="right">{formatMoney(r.cost)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      <Section title="Top subscribers by cost" description="The twenty most expensive accounts this month, with how much of their allowance they have used.">
        {topUsers.length === 0 ? (
          <Empty>Nobody used an advisor in {periodLabel(period)}.</Empty>
        ) : (
          <Table minWidth="48rem" caption={`Top subscribers in ${periodLabel(period)}`}>
            <thead>
              <tr>
                <Th>Subscriber</Th>
                <Th align="right">Requests</Th>
                <Th align="right">Tokens</Th>
                <Th align="right">Estimated cost</Th>
                <Th align="right">Cap used</Th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <Link href={`/admin/users/${u.user.id}`} className="py-3 text-ink underline decoration-line underline-offset-4 hover:text-sage">
                      {u.user.name ?? u.user.email}
                    </Link>
                    {u.user.name && <div className="text-xs text-ink-muted">{u.user.email}</div>}
                  </Td>
                  <Td align="right">{formatNumber(u.requests)}</Td>
                  <Td align="right">{formatNumber(u.tokensIn + u.tokensOut)}</Td>
                  <Td align="right">{formatMoney(u.costMicros)}</Td>
                  <Td align="right" className={u.top && u.top.pct >= 100 ? "text-danger" : u.top && u.top.pct >= 80 ? "text-gold" : ""}>
                    {u.top ? (
                      <>
                        {u.top.pct}% <span className="text-xs text-ink-muted">{u.top.name}</span>
                      </>
                    ) : (
                      <span className="text-ink-muted">No access now</span>
                    )}
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
