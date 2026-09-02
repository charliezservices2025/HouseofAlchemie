"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

export type RailUser = { name: string | null; email: string; isAdmin: boolean };
export type RailAdvisor = { slug: string; name: string; title: string; unlocked: boolean; accent: string | null };
export type RailConversation = { id: string; title: string; advisorSlug: string; advisorName: string };

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 pt-5">
      <div className="eyebrow mb-2">{label}</div>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function Item({ href, active, children, muted, onNavigate }: { href: string; active: boolean; children: React.ReactNode; muted?: boolean; onNavigate?: () => void }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`flex min-h-10 items-center justify-between gap-3 border-b border-line-soft py-2 text-[0.9375rem] no-underline transition-colors ${
          active ? "text-sage" : muted ? "text-ink-muted hover:text-ink" : "text-ink hover:text-sage"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

export function Rail({ user, advisors, conversations, onNavigate }: { user: RailUser; advisors: RailAdvisor[]; conversations: RailConversation[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-6">
      <Section label="Your team">
        {advisors.map((a) => (
          <Item key={a.slug} href={a.unlocked ? `/chat/${a.slug}` : `/advisors#${a.slug}`} active={pathname.startsWith(`/chat/${a.slug}`)} muted={!a.unlocked} onNavigate={onNavigate}>
            <span className="flex items-center gap-2.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: a.unlocked ? (a.accent ?? "#2a544b") : "#e3e0d8" }} aria-hidden="true" />
              {a.name}
            </span>
            {!a.unlocked && <Lock className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.5} aria-label="Locked" />}
          </Item>
        ))}
        <Item href="/advisors" active={pathname === "/advisors"} onNavigate={onNavigate}>
          <span className="text-ink-muted">All advisors</span>
        </Item>
      </Section>

      {conversations.length > 0 && (
        <Section label="Conversations">
          {conversations.map((c) => (
            <Item key={c.id} href={`/chat/${c.advisorSlug}/${c.id}`} active={pathname.endsWith(`/${c.id}`)} onNavigate={onNavigate}>
              <span className="truncate">{c.title}</span>
              <span className="shrink-0 text-xs text-ink-muted">{c.advisorName}</span>
            </Item>
          ))}
          <Item href="/conversations" active={pathname === "/conversations"} onNavigate={onNavigate}>
            <span className="text-ink-muted">All conversations</span>
          </Item>
        </Section>
      )}

      <Section label="What we remember">
        <Item href="/memory" active={pathname === "/memory"} onNavigate={onNavigate}>Your business profile</Item>
      </Section>

      <Section label="Account">
        <Item href="/settings" active={pathname === "/settings"} onNavigate={onNavigate}>Settings</Item>
        {user.isAdmin && <Item href="/admin" active={pathname.startsWith("/admin")} onNavigate={onNavigate}>Admin</Item>}
        <li>
          <form action={signOut}>
            <button type="submit" className="flex min-h-10 w-full items-center border-b border-line-soft py-2 text-left text-[0.9375rem] text-ink-muted transition-colors hover:text-ink">
              Sign out
            </button>
          </form>
        </li>
      </Section>

      <div className="mt-auto px-5 pt-6 text-xs text-ink-muted">
        <div className="truncate">{user.name ?? user.email}</div>
      </div>
    </nav>
  );
}
