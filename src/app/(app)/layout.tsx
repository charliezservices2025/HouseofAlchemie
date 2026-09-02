import { requireUser } from "@/lib/auth/current-user";
import { getAdvisorAccess } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [access, recent] = await Promise.all([
    getAdvisorAccess(user.id),
    db.conversation.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, advisor: { select: { slug: true, name: true } } },
    }),
  ]);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, isAdmin: user.role === "ADMIN" }}
      advisors={access.map((a) => ({ slug: a.advisor.slug, name: a.advisor.name, title: a.advisor.title, unlocked: a.unlocked, accent: a.advisor.accentColor }))}
      conversations={recent.map((c) => ({ id: c.id, title: c.title, advisorSlug: c.advisor.slug, advisorName: c.advisor.name }))}
    >
      {children}
    </AppShell>
  );
}
