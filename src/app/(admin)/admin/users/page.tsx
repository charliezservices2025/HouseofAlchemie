import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { PageHeader, Table, Th, Td, Pill, Empty } from "@/components/admin/ui";
import { formatDateTime } from "@/components/admin/format";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 100);

  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      entitlements: {
        where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        include: { advisor: { select: { name: true } }, suite: { select: { name: true } } },
      },
      sessions: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { lastSeenAt: true } },
    },
  });

  return (
    <>
      <PageHeader eyebrow="Users" title="Everyone with an account" description="Search by email or name. Open a person to grant access, revoke it, or send them a set password link." />

      <form method="get" action="/admin/users" role="search" className="mb-6 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="q" className="sr-only">
          Search by email or name
        </label>
        <input id="q" name="q" type="search" className="field sm:max-w-md" placeholder="Email or name" defaultValue={q} autoComplete="off" />
        <div className="flex gap-2">
          <button type="submit" className="btn">
            Search
          </button>
          {q && (
            <Link href="/admin/users" className="btn btn-secondary no-underline">
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="mb-3 text-xs text-ink-muted">
        {users.length === 200 ? "Showing the first 200. Narrow the search to see the rest." : `${users.length} ${users.length === 1 ? "person" : "people"}${q ? ` matching "${q}"` : ""}.`}
      </p>

      {users.length === 0 ? (
        <Empty>{q ? "Nobody matches that search." : "No accounts yet. The first Kajabi purchase will create one."}</Empty>
      ) : (
        <Table minWidth="56rem" caption="Users">
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Verified</Th>
              <Th>Onboarded</Th>
              <Th>Access</Th>
              <Th>Last seen (UTC)</Th>
              <Th>
                <span className="sr-only">Open</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <Td>
                  <div className="text-ink">{u.name ?? <span className="text-ink-muted">No name</span>}</div>
                  <div className="text-xs text-ink-muted">{u.email}</div>
                </Td>
                <Td>{u.role === "ADMIN" ? <Pill tone="ink">Admin</Pill> : <Pill>Subscriber</Pill>}</Td>
                <Td>{u.emailVerifiedAt ? <Pill tone="ok">Yes</Pill> : <Pill tone="warn">No</Pill>}</Td>
                <Td>{u.onboardedAt ? <Pill tone="ok">Yes</Pill> : <Pill>Not yet</Pill>}</Td>
                <Td>
                  {u.entitlements.length === 0 ? (
                    <span className="text-ink-muted">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.entitlements.map((e) => (
                        <Pill key={e.id} tone={e.source === "KAJABI" ? "ok" : "muted"}>
                          {e.advisor?.name ?? e.suite?.name ?? "Unknown"}
                        </Pill>
                      ))}
                    </div>
                  )}
                </Td>
                <Td muted className="whitespace-nowrap">{formatDateTime(u.sessions[0]?.lastSeenAt)}</Td>
                <Td>
                  <Link href={`/admin/users/${u.id}`} className="inline-flex min-h-11 items-center whitespace-nowrap text-sage underline underline-offset-4 hover:text-sage-deep">
                    Open
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
