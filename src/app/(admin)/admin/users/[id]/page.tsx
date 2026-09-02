import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { currentPeriod } from "@/lib/usage";
import { getAdvisorAccess } from "@/lib/entitlements";
import { forceSignOut, grantEntitlement, resendSetPassword, revokeEntitlement, toggleAdminRole } from "@/app/(admin)/admin/actions";
import { ActionButton, ActionForm } from "@/components/admin/action-form";
import { PageHeader, Section, Table, Th, Td, Pill, Empty, Field, KeyValue, TextLink, Notice } from "@/components/admin/ui";
import { formatDate, formatDateTime, formatMoney, formatNumber, percent, periodLabel } from "@/components/admin/format";

export const metadata: Metadata = { title: "User" };

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const period = currentPeriod();

  const user = await db.user.findUnique({
    where: { id },
    include: {
      entitlements: { orderBy: { grantedAt: "desc" }, include: { advisor: { select: { name: true } }, suite: { select: { name: true } } } },
      sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" }, select: { id: true, lastSeenAt: true } },
      usage: { where: { period, advisorId: { not: null } }, include: { advisor: { select: { id: true, name: true } } } },
      conversations: { where: { archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, title: true, updatedAt: true, advisor: { select: { name: true } } } },
      profile: { select: { updatedAt: true } },
      _count: { select: { memories: { where: { archivedAt: null } }, conversations: true } },
    },
  });
  if (!user) notFound();

  const [advisors, suites, access] = await Promise.all([
    db.advisor.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
    db.suite.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
    getAdvisorAccess(user.id),
  ]);
  const capFor = new Map(access.map((a) => [a.advisor.id, a.monthlyTokenCap]));

  const active = user.entitlements.filter((e) => e.status === "ACTIVE" && (!e.expiresAt || e.expiresAt > new Date()));
  const past = user.entitlements.filter((e) => !active.includes(e));
  const isSelf = user.id === admin.id;
  const emailConnected = Boolean(process.env.RESEND_API_KEY);

  return (
    <>
      <div className="mb-2 text-sm">
        <TextLink href="/admin/users">All users</TextLink>
      </div>
      <PageHeader
        eyebrow={user.role === "ADMIN" ? "Admin account" : "Subscriber"}
        title={user.name ?? user.email}
        description={user.name ? user.email : undefined}
        actions={
          <>
            {user.role === "ADMIN" ? <Pill tone="ink">Admin</Pill> : <Pill>Subscriber</Pill>}
            {user.lockedUntil && user.lockedUntil > new Date() && <Pill tone="danger">Locked until {formatDateTime(user.lockedUntil)}</Pill>}
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <Section title="Profile">
            <KeyValue
              rows={[
                { label: "Email", value: user.email },
                { label: "Verified", value: user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : "Not yet" },
                { label: "Password", value: user.passwordHash ? "Set" : "Not set yet" },
                { label: "Onboarded", value: user.onboardedAt ? formatDateTime(user.onboardedAt) : "Not yet" },
                { label: "Joined", value: formatDateTime(user.createdAt) },
                { label: "Active sessions", value: `${user.sessions.length}, last seen ${formatDateTime(user.sessions[0]?.lastSeenAt)}` },
                { label: "Memory", value: `${formatNumber(user._count.memories)} facts, ${formatNumber(user._count.conversations)} conversations in total` },
                { label: "Type", value: `${user.fontPreset} at ${user.textScale}%` },
              ]}
            />
          </Section>

          <Section title="Access" description="Active entitlements first. Kajabi grants are revoked automatically when Kajabi says so; admin and comp grants are yours to manage.">
            {user.entitlements.length === 0 ? (
              <Empty>No access yet. Grant an advisor or a suite from the panel.</Empty>
            ) : (
              <Table minWidth="52rem" caption="Entitlements">
                <thead>
                  <tr>
                    <Th>What</Th>
                    <Th>Status</Th>
                    <Th>Source</Th>
                    <Th>Kajabi offer</Th>
                    <Th>Granted</Th>
                    <Th>Expires</Th>
                    <Th>Note</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {[...active, ...past].map((e) => {
                    const isActive = active.includes(e);
                    return (
                      <tr key={e.id}>
                        <Td muted={!isActive}>{e.advisor?.name ?? e.suite?.name ?? "Unknown"}</Td>
                        <Td>{isActive ? <Pill tone="ok">Active</Pill> : e.status === "REVOKED" ? <Pill tone="danger">Revoked</Pill> : <Pill>Expired</Pill>}</Td>
                        <Td muted={!isActive}>{e.source}</Td>
                        <Td muted={!isActive} className="font-mono text-xs">{e.kajabiOfferId ?? ""}</Td>
                        <Td muted={!isActive} className="whitespace-nowrap">{formatDate(e.grantedAt)}</Td>
                        <Td muted={!isActive} className="whitespace-nowrap">{e.revokedAt ? `Revoked ${formatDate(e.revokedAt)}` : formatDate(e.expiresAt, "Never")}</Td>
                        <Td muted={!isActive} className="max-w-[14rem] break-words">{e.note ?? ""}</Td>
                        <Td>{isActive && <ActionButton action={revokeEntitlement} label="Revoke" pendingLabel="Revoking" confirm={`Revoke ${e.advisor?.name ?? e.suite?.name ?? "this access"} for ${user.email}?`} hidden={{ entitlementId: e.id }} />}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Section>

          <Section title={`Usage in ${periodLabel(period)}`} description="Tokens against each advisor's cap. The cap comes from the largest entitlement that unlocks the advisor.">
            {user.usage.length === 0 ? (
              <Empty>No conversations this month.</Empty>
            ) : (
              <Table minWidth="36rem" caption="Usage this month">
                <thead>
                  <tr>
                    <Th>Advisor</Th>
                    <Th align="right">Requests</Th>
                    <Th align="right">Tokens</Th>
                    <Th align="right">Cap</Th>
                    <Th align="right">Used</Th>
                    <Th align="right">Cost</Th>
                  </tr>
                </thead>
                <tbody>
                  {user.usage.map((u) => {
                    const used = u.tokensIn + u.tokensOut;
                    const cap = capFor.get(u.advisorId ?? "") ?? 0;
                    const pct = percent(used, cap);
                    return (
                      <tr key={u.id}>
                        <Td>{u.advisor?.name ?? "Removed advisor"}</Td>
                        <Td align="right">{formatNumber(u.requests)}</Td>
                        <Td align="right">{formatNumber(used)}</Td>
                        <Td align="right">{cap ? formatNumber(cap) : "No access"}</Td>
                        <Td align="right" className={pct >= 100 ? "text-danger" : pct >= 80 ? "text-gold" : ""}>{cap ? `${pct}%` : ""}</Td>
                        <Td align="right">{formatMoney(u.costMicros)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Section>

          <Section title="Recent conversations" description="Titles only. What a subscriber says to an advisor stays between them.">
            {user.conversations.length === 0 ? (
              <Empty>No conversations yet.</Empty>
            ) : (
              <Table minWidth="30rem" caption="Recent conversations">
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>Advisor</Th>
                    <Th>Last message (UTC)</Th>
                  </tr>
                </thead>
                <tbody>
                  {user.conversations.map((c) => (
                    <tr key={c.id}>
                      <Td>{c.title}</Td>
                      <Td>{c.advisor.name}</Td>
                      <Td muted className="whitespace-nowrap">{formatDateTime(c.updatedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start" aria-label="Actions for this user">
          <div className="card p-4">
            <h2 className="mb-1 text-lg">Grant access</h2>
            <p className="mb-4 text-xs text-ink-muted">For a gift, a partner, or a fix while Kajabi catches up.</p>
            <ActionForm action={grantEntitlement} submitLabel="Grant" pendingLabel="Granting" hidden={{ userId: user.id }} variant="btn btn-sage">
              <Field label="Advisor or suite" htmlFor="target">
                <select id="target" name="target" className="field" required defaultValue="">
                  <option value="" disabled>
                    Choose
                  </option>
                  <optgroup label="Suites">
                    {suites.map((s) => (
                      <option key={s.id} value={`suite:${s.id}`}>
                        {s.name}
                        {s.isActive ? "" : " (inactive)"}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Advisors">
                    {advisors.map((a) => (
                      <option key={a.id} value={`advisor:${a.id}`}>
                        {a.name}
                        {a.isActive ? "" : " (inactive)"}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </Field>
              <Field label="Granted as" htmlFor="source">
                <select id="source" name="source" className="field" defaultValue="ADMIN">
                  <option value="ADMIN">Admin, a manual grant</option>
                  <option value="COMP">Comp, complimentary access</option>
                </select>
              </Field>
              <Field label="Note" htmlFor="note" hint="Optional. Why, and who asked.">
                <input id="note" name="note" className="field" maxLength={200} autoComplete="off" />
              </Field>
              <Field label="Expires" htmlFor="expiresAt" hint="Optional. Access ends at the end of that day, UTC.">
                <input id="expiresAt" name="expiresAt" type="date" className="field" />
              </Field>
            </ActionForm>
          </div>

          <div className="card flex flex-col gap-4 p-4">
            <h2 className="text-lg">Account</h2>
            <div>
              <ActionButton
                action={resendSetPassword}
                label={user.passwordHash ? "Send set password link" : "Resend set password email"}
                pendingLabel="Sending"
                hidden={{ userId: user.id }}
                small={false}
              />
              <p className="mt-1 text-xs text-ink-muted">
                {user.passwordHash ? "Lets them choose a new password without the old one. Valid for seven days." : "They have not set a password yet. This sends a fresh link, valid for seven days."}
              </p>
              {!emailConnected && <p className="mt-1 text-xs text-gold">Email is not connected, so the link will be printed to the server log.</p>}
            </div>
            <div>
              <ActionButton action={forceSignOut} label="Sign out everywhere" pendingLabel="Signing out" confirm={`Sign ${user.email} out of every device?`} hidden={{ userId: user.id }} small={false} />
              <p className="mt-1 text-xs text-ink-muted">{isSelf ? "Every device except this one." : "Ends every active session. They sign in again with the same password."}</p>
            </div>
            <div>
              {isSelf && user.role === "ADMIN" ? (
                <Notice>You cannot remove your own admin access. Ask another admin.</Notice>
              ) : (
                <ActionButton
                  action={toggleAdminRole}
                  label={user.role === "ADMIN" ? "Remove admin access" : "Make an admin"}
                  pendingLabel="Saving"
                  confirm={user.role === "ADMIN" ? `Remove admin access from ${user.email}?` : `Give ${user.email} full admin access?`}
                  hidden={{ userId: user.id }}
                  variant={user.role === "ADMIN" ? "btn btn-secondary text-danger border-danger" : "btn btn-secondary"}
                  small={false}
                />
              )}
              {!isSelf && <p className="mt-1 text-xs text-ink-muted">Admins see this screen and the account of every subscriber.</p>}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
