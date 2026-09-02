# House of Alchemie

The private advisor platform behind [houseofalchemie.ai](https://www.houseofalchemie.ai/). Subscribers buy on Kajabi, then sign in here to talk to their advisors: Evren first, then Lyra, Lumi, Rune and Auren, sold alone or in three suites. Every advisor reads the same memory of the subscriber's business, which is the reason to buy a suite and the reason this is not a chat window with a logo on it.

This README is for whoever runs the code. The plain language guides for Erica are in `docs/`.

## What it does

- Accounts with verified email, password reset, revocable sessions, rate limiting and lockout.
- Access granted and revoked automatically from Kajabi purchase and cancellation webhooks.
- A shared intake at sign up, plus a few questions per advisor, all editable as settings.
- Chat that streams word by word, saves every conversation, and formats tables and plans properly.
- Long term memory: structured facts, rolling summaries, and a screen where the subscriber corrects what is remembered.
- Erica's frameworks indexed and searched before an advisor answers, with citations.
- Usage caps per advisor and per suite so a heavy user cannot cost more than they pay.
- An admin area for people, access, usage, Kajabi events, knowledge documents and settings.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript strict |
| Styling | Tailwind 4 with the brand tokens in `src/app/globals.css` |
| Database | PostgreSQL with pgvector, on Railway |
| ORM | Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`) |
| AI | AI SDK 7 with `@ai-sdk/anthropic`; Claude for answers, Haiku for background jobs |
| Embeddings | Voyage (`voyage-3-large`, 1024 dimensions) |
| Email | Resend |
| Hosting | Vercel |

## Local setup

1. Install Node 20 or newer, then:

   ```bash
   npm install
   ```

   `postinstall` runs `prisma generate`, so the client in `src/generated/prisma` exists before anything imports it.

2. Create `.env` in the project root. One line each:

   ```bash
   DATABASE_URL=postgresql://user:pass@host:5432/db        # Postgres with pgvector
   AUTH_SECRET=<long random string>                         # reserved, see the table below
   KAJABI_WEBHOOK_SECRET=<long random string>              # goes in the Kajabi webhook URL
   APP_URL=http://localhost:3000                           # used in email links
   # Optional until you want the real thing:
   # ANTHROPIC_API_KEY=sk-ant-...
   # VOYAGE_API_KEY=pa-...
   # RESEND_API_KEY=re_...
   # EMAIL_FROM="House of Alchemie <hello@houseofalchemie.ai>"
   # ADMIN_EMAIL=you@example.com
   ```

   Generate secrets with `openssl rand -base64 32`.

3. Apply the schema and seed the registry:

   ```bash
   npx prisma migrate deploy
   npm run db:seed
   ```

   The seed upserts the five advisors and three suites by slug, and creates the first admin (from `ADMIN_EMAIL`) with a one time set password link printed to the terminal. It is safe to run again; it never overwrites prompts, caps or Kajabi mappings once they exist.

4. Run it:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. Without `ANTHROPIC_API_KEY` the chat screen says the advisor is not connected yet instead of answering. Without `RESEND_API_KEY` every email is printed to the terminal, so sign up, reset and set password links are all testable.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma migrate deploy`, then `prisma generate`, then `next build`. Migrations run as part of every build, so the build needs a reachable `DATABASE_URL`. |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over the project |
| `npm run db:migrate` | `prisma migrate deploy` (apply committed migrations, never edits them) |
| `npm run db:seed` | Seed advisors, suites and the first admin |

To change the schema in development: edit `prisma/schema.prisma`, run `npx prisma migrate dev --name what_changed`, commit the new folder under `prisma/migrations/`.

## Environment variables

| Variable | What it is for | What breaks without it |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string | Everything. The app throws on first query and `/api/health` reports `database: error`. |
| `AUTH_SECRET` | Reserved for signed cookies and CSRF tokens | Nothing today. Sessions are random database backed tokens, not signed cookies, so no code reads this yet. Keep it set so a future change is a code change only. |
| `KAJABI_WEBHOOK_SECRET` | The token in the Kajabi webhook URL | Every webhook call gets 403. Purchases stop granting access and cancellations stop revoking it. |
| `APP_URL` | Public origin, no trailing slash | Email links point at `http://localhost:3000`. Set it to `https://app.houseofalchemie.ai` in production. |
| `ANTHROPIC_API_KEY` | Claude, for answers and background memory jobs | Chat returns `503 { code: "AI_NOT_CONFIGURED" }` and the UI says the advisor is not connected yet. Memory extraction, summaries and auto titles silently skip. |
| `VOYAGE_API_KEY` | Embeddings for the knowledge library | Documents are chunked but stay `PENDING` with a note; retrieval returns nothing and advisors answer from their prompt alone. |
| `RESEND_API_KEY` | Sending email | Emails are written to the server log instead of sent. Fine locally, fatal in production because nobody receives their set password link. |
| `EMAIL_FROM` | The From header | Falls back to `House of Alchemie <onboarding@resend.dev>`, which Resend only allows for testing. |
| `ADMIN_EMAIL` | Who the seed makes admin | The seed falls back to my address. Set it to Erica's before seeding production. |

`/api/health` reports which of these integrations are configured without revealing any value. Check it after every deploy.

## Deployment

Production is Vercel for the app and Railway for Postgres. Both accounts are in Erica's name, per the agreement.

1. **Railway.** Create a Postgres service from Railway's Postgres template (it ships with pgvector; the first migration runs `CREATE EXTENSION IF NOT EXISTS vector`). Copy the public `DATABASE_URL`. Turn on daily backups in the service settings.
2. **Vercel.** Import the GitHub repository. Framework preset Next.js, default build command (`npm run build`). That script already runs `prisma migrate deploy` before `next build`, so every deploy applies pending migrations against the `DATABASE_URL` in that environment. If you would rather keep migrations out of the build, change the `build` script in `package.json` to `prisma generate && next build` and run `npm run db:migrate` by hand with the production `DATABASE_URL` before each deploy that carries a migration.
3. **Environment.** Add every variable in the table above to the Production environment, and a separate database plus the same variables to Preview if you want a staging environment.
4. **Domain.** Add `app.houseofalchemie.ai` in Vercel and point a CNAME at it. Note that the DNS for houseofalchemie.ai lives inside Kajabi's Cloudflare zone, so the record is added through Kajabi's domain settings or Kajabi support, not at the registrar.
5. **Seed.** From your machine with the production `DATABASE_URL` and `ADMIN_EMAIL` set: `npm run db:seed`. Send Erica the printed set password link.
6. **Kajabi.** Follow `docs/KAJABI-SETUP.md` to point the webhook at `https://app.houseofalchemie.ai/api/kajabi/webhook?token=<KAJABI_WEBHOOK_SECRET>`.
7. **Verify.** Open `/api/health` and confirm `status: ok` and every integration `true`.

Every push to `main` deploys. Pull requests get preview URLs. A failed typecheck or build never reaches the live site.

## Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit, with file paths.
- [docs/RUNBOOK.md](docs/RUNBOOK.md): day to day operations for a developer who is not me.
- [docs/KAJABI-SETUP.md](docs/KAJABI-SETUP.md): connecting the Kajabi offers, written for Erica.
- [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md): the Phase 1 acceptance checklist from the agreement.
- [CLAUDE.md](CLAUDE.md): conventions and brand rules for anyone, human or otherwise, editing the code.
