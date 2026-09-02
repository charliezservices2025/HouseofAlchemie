# House of Alchemie

AI business advisor platform for Erica Powell's luxury service entrepreneurs. Five advisors (Evren, Lyra, Lumi, Rune, Auren), three suites, one shared memory. Sold through Kajabi checkouts; this app grants access from Kajabi webhooks.

## Stack and layout

- Next.js 16 App Router, TypeScript strict, Tailwind 4, React 19.
- Prisma 7 with `@prisma/adapter-pg`. Client generated to `src/generated/prisma`; import from `@/generated/prisma/client`. Use `db` from `@/lib/db`.
- AI SDK v7 (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`). Streaming via `toUIMessageStreamResponse`, client via `useChat` with `DefaultChatTransport`.
- Route groups: `(auth)` public auth pages, `(app)` signed in subscriber pages inside `AppShell`, `(admin)` admin pages. API in `src/app/api`.
- `src/proxy.ts` is Next 16's middleware (security headers only). Auth is enforced in layouts and handlers.

## Auth and data helpers

- Pages: `requireUser()` (redirects to sign in, then to verify email if unverified), `requireAdmin()`. Route handlers: `userFromRequest()`.
- Server actions return `ActionState = { error?, ok?, message? }` and are consumed with `useActionState`. Existing auth actions live in `src/app/(auth)/actions.ts`.
- Access: `getAdvisorAccess(userId)` and `getUnlockedAdvisor(userId, slug)` in `@/lib/entitlements`. Usage: `getUsageSnapshot` in `@/lib/usage`. Settings: `getSetting`/`setSetting` in `@/lib/settings` (typed keys with defaults).
- Never trust client supplied ids without scoping the query to the current user.

## Brand rules (non negotiable)

- **No em dashes or en dashes anywhere**: UI copy, code strings, comments, prompts, emails. Use commas, full stops, colons, or plain hyphens.
- Type via CSS variables only: `font-display` for headings, body inherits. Never hardcode a font family. Users can switch presets in Settings.
- Palette tokens from `globals.css`: ink, ink-soft, ink-muted, sage, sage-deep, sage-light, sage-mist, sage-whisper, cream, paper, line, line-soft, gold, danger. No other colours.
- Utility classes already defined: `.btn`, `.btn-secondary`, `.btn-ghost`, `.btn-sage`, `.field`, `.card`, `.eyebrow`, `.hairline`, `.prose-hoa`, `.caret`, `.safe-bottom`. Use them before inventing new ones.
- **Not an AI looking layout.** No gradients, no glassmorphism, no glowing borders, no rounded-everything, no emoji, no purple, no giant hero blobs, no "sparkle" icons. Sharp corners, hairlines, generous white space, editorial rhythm, quiet confidence. It should look like the sales pages at houseofalchemie.ai, not like a chatbot template.
- Copy is warm, direct, and short. Sentence case. No exclamation marks.

## Phone first

- Design for a 390px phone first, then iPad (768 to 1024), then laptop. Every screen must be usable one handed with the keyboard open.
- Touch targets at least 44px. Inputs at least 16px font so iOS does not zoom.
- Chat: the composer pins to the bottom of the main column; the message list scrolls; respect `env(safe-area-inset-bottom)` via `.safe-bottom`.
- Tables inside answers scroll horizontally inside their own container (`.prose-hoa table` already does this). The page must never scroll sideways.

## Working rules

- Own only the files you were assigned. Do not edit shared files (`globals.css`, `layout.tsx`, `lib/*`, `schema.prisma`) unless the task explicitly says so. If you need something shared changed, describe it in your report instead.
- Run `npx tsc --noEmit` and `npx eslint <your files>` before you finish. Fix what you own.
- Accessibility is not optional: labels on every input, `aria-current` on active nav, focus visible, semantic headings in order.
- No new dependencies without saying why in your report.
