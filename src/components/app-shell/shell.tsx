"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/wordmark";
import { Rail, type RailAdvisor, type RailConversation, type RailUser } from "./rail";

export type AppShellProps = {
  user: RailUser;
  advisors: RailAdvisor[];
  conversations: RailConversation[];
  children: React.ReactNode;
};

/**
 * Phone first. On a phone the rail is a drawer behind a menu button; on a
 * tablet or laptop it sits alongside the content. The chat composer relies
 * on the main column being a flex column with min-height 0 so it can pin to
 * the bottom without the page scrolling under the keyboard.
 */
export function AppShell({ user, advisors, conversations, children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Mobile top bar: exactly 3.5rem so the main column's offset below matches it */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-cream/95 px-4 backdrop-blur lg:hidden">
        <Wordmark size="sm" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost inline-flex h-10 w-10 items-center justify-center border border-transparent"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="app-rail"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </header>

      {/* Drawer scrim */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
        />
      )}

      {/* Rail */}
      <aside
        id="app-rail"
        className={`fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[86vw] transform flex-col border-r border-line bg-paper transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:max-w-none lg:translate-x-0 lg:overflow-y-auto lg:bg-cream ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Navigation"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <Wordmark size="sm" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn-ghost inline-flex h-9 w-9 items-center justify-center border border-transparent lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <Rail user={user} advisors={advisors} conversations={conversations} onNavigate={close} />
      </aside>

      {/* Main */}
      <main className="flex min-h-[calc(100dvh-3.5rem)] min-w-0 flex-col lg:min-h-dvh">{children}</main>
    </div>
  );
}
