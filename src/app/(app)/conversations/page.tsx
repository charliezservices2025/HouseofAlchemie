import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { ConversationActions } from "@/components/chat/conversation-actions";
import { firstLine, relativeTime } from "@/components/chat/relative-time";

export const metadata: Metadata = { title: "All conversations" };

type Search = Promise<{ q?: string | string[]; advisor?: string | string[]; archived?: string | string[] }>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function hrefFor(state: { q: string; advisor: string; archived: boolean }) {
  const p = new URLSearchParams();
  if (state.q) p.set("q", state.q);
  if (state.advisor) p.set("advisor", state.advisor);
  if (state.archived) p.set("archived", "1");
  const s = p.toString();
  return s ? `/conversations?${s}` : "/conversations";
}

export default async function ConversationsPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser("/conversations");
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 200);
  const advisorSlug = one(sp.advisor).trim().slice(0, 40);
  const archived = one(sp.archived) === "1";

  const where: Prisma.ConversationWhereInput = {
    userId: user.id,
    ...(archived ? {} : { archivedAt: null }),
    ...(advisorSlug ? { advisor: { slug: advisorSlug } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { messages: { some: { content: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [conversations, advisors] = await Promise.all([
    db.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        archivedAt: true,
        advisor: { select: { slug: true, name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, role: true } },
      },
    }),
    db.advisor.findMany({
      where: { conversations: { some: { userId: user.id } } },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
  ]);

  const now = new Date();
  const chip = (active: boolean) =>
    `inline-flex min-h-11 items-center border px-3 text-xs uppercase tracking-[0.12em] no-underline transition-colors ${
      active ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink hover:text-ink"
    }`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="eyebrow">Your history</p>
      <h1 className="mt-2 font-display text-3xl leading-tight text-ink">All conversations</h1>

      <form method="get" action="/conversations" className="mt-8 flex gap-2">
        {advisorSlug && <input type="hidden" name="advisor" value={advisorSlug} />}
        {archived && <input type="hidden" name="archived" value="1" />}
        <label htmlFor="conversation-search" className="sr-only">
          Search your conversations
        </label>
        <input
          id="conversation-search"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search titles and messages"
          maxLength={200}
          className="field min-w-0 flex-1 text-[max(1rem,16px)]!"
        />
        <button type="submit" className="btn btn-secondary h-11 shrink-0 px-4">
          Search
        </button>
      </form>

      {(advisors.length > 1 || archived) && (
        <nav aria-label="Filter by advisor" className="mt-4 flex flex-wrap gap-2">
          <Link href={hrefFor({ q, advisor: "", archived })} className={chip(!advisorSlug)} aria-current={!advisorSlug ? "page" : undefined}>
            All
          </Link>
          {advisors.map((a) => (
            <Link
              key={a.slug}
              href={hrefFor({ q, advisor: a.slug, archived })}
              className={chip(advisorSlug === a.slug)}
              aria-current={advisorSlug === a.slug ? "page" : undefined}
            >
              {a.name}
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 text-xs text-ink-muted">
        <span>
          {conversations.length === 0 ? "Nothing here" : `${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"}`}
          {q ? ` matching "${q}"` : ""}
        </span>
        <Link href={hrefFor({ q, advisor: advisorSlug, archived: !archived })} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-ink">
          {archived ? "Hide archived" : "Show archived"}
        </Link>
      </div>

      {conversations.length === 0 ? (
        <div className="hairline mt-2 py-10">
          {q || advisorSlug ? (
            <p className="text-ink-soft">
              Nothing matches. <Link href={hrefFor({ q: "", advisor: "", archived })} className="text-sage underline underline-offset-4">Clear the search</Link> and try again.
            </p>
          ) : (
            <p className="text-ink-soft">
              You have not started a conversation yet. <Link href="/advisors" className="text-sage underline underline-offset-4">Choose an advisor</Link> to begin.
            </p>
          )}
        </div>
      ) : (
        <ul className="hairline mt-2">
          {conversations.map((c) => {
            const last = c.messages[0];
            const preview = last ? firstLine(last.content) : "";
            const isArchived = Boolean(c.archivedAt);
            return (
              <li key={c.id} className="border-b border-line py-5">
                <Link href={`/chat/${c.advisor.slug}/${c.id}`} className="group block no-underline">
                  <h2 className="font-display text-xl leading-snug text-ink transition-colors group-hover:text-sage">{c.title}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                    <span>{c.advisor.name}</span>
                    <span aria-hidden="true">|</span>
                    <time dateTime={c.updatedAt.toISOString()}>{relativeTime(c.updatedAt, now)}</time>
                    {isArchived && (
                      <>
                        <span aria-hidden="true">|</span>
                        <span>Archived</span>
                      </>
                    )}
                  </p>
                  {preview && (
                    <p className="mt-2 line-clamp-1 text-[0.9375rem] text-ink-soft">
                      {last?.role === "USER" ? "You: " : `${c.advisor.name}: `}
                      {preview}
                    </p>
                  )}
                </Link>
                <ConversationActions id={c.id} title={c.title} archived={isArchived} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
