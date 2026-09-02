import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/current-user";
import { Wordmark } from "@/components/wordmark";
import { AdminNav } from "@/components/admin/nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin | House of Alchemie" },
};

/**
 * The admin frame. Its own top bar and sub nav rather than the subscriber
 * shell, so Erica's team always knows which side of the house they are on.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-line bg-cream">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex min-h-14 items-center justify-between gap-4 py-3">
            <div className="flex min-w-0 items-baseline gap-3">
              <Wordmark size="sm" />
              <span className="eyebrow">Admin</span>
            </div>
            <div className="truncate text-xs text-ink-muted">{user.name ?? user.email}</div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
