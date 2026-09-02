# Runbook

For the developer who is not me. Everything here assumes you have the repository, a Vercel login on Erica's team, a Railway login on her workspace, and admin access to the app. If you have none of those yet, Erica owns all three and can add you in a few minutes.

Read `README.md` first for the environment variables and `docs/ARCHITECTURE.md` for how the pieces fit.

## Rotate a secret

**KAJABI_WEBHOOK_SECRET** (most likely one to rotate, because it sits in a URL)

1. Generate a new value: `openssl rand -base64 32`.
2. In Vercel, Project > Settings > Environment Variables, update `KAJABI_WEBHOOK_SECRET` for Production. Redeploy.
3. In Kajabi, update the webhook URL to `https://app.houseofalchemie.ai/api/kajabi/webhook?token=<new value>` (see `docs/KAJABI-SETUP.md`).
4. Do steps 2 and 3 within a few minutes of each other. Any purchase in the gap returns 403 to Kajabi and is not recorded, so check Kajabi's recent purchases afterwards and grant anyone missed by hand (see "Comp a subscriber").

**DATABASE_URL**

1. In Railway, open the Postgres service > Variables and regenerate `PGPASSWORD` (Railway rebuilds `DATABASE_URL` from it).
2. Copy the new `DATABASE_URL` into Vercel and redeploy. The old connection string stops working the moment Railway applies the change, so expect a minute of errors between the two steps. Do it at a quiet hour.

**ANTHROPIC_API_KEY, VOYAGE_API_KEY, RESEND_API_KEY**

Create a new key in that provider's console, update the Vercel variable, redeploy, confirm `/api/health` shows the integration as `true`, then delete the old key at the provider.

**AUTH_SECRET**

No code reads it today (sessions are database backed random tokens). Rotating it changes nothing. It is there so a future signed cookie or CSRF token has somewhere to come from.

## Add an admin

Two ways.

- In the app: Admin > Users, open the person, and press "Make an admin" in the account panel. The same button reads "Remove admin access" for an existing admin, and you cannot remove your own. Every change writes an audit log row with who did it.
- From a terminal, if nobody with admin access is available: set `ADMIN_EMAIL=person@example.com` and the production `DATABASE_URL`, then `npm run db:seed`. The seed creates that account as an admin (and prints a one time set password link) or, if the account exists, promotes it. It does not touch anything else.

Admins see the Admin link in the rail. They are still subscribers as far as chat is concerned, so an admin without an entitlement cannot open an advisor. Comp yourself if you need to test chat.

## Comp a subscriber

A comp is an entitlement with source `COMP`. Kajabi knows nothing about it, and a Kajabi cancellation will not remove it, which is the point.

1. The person needs an account first. Admin does not create accounts; they come from a Kajabi purchase or from the sign up page. If they have neither, ask them to create one at `https://app.houseofalchemie.ai/sign-up` and confirm their email. They then appear in Admin > Users.
2. Admin > Users. Search by email, open the person, and use the "Grant access" panel: choose an advisor or a suite, set "Granted as" to Comp, optionally an expiry date, and a note saying why. The note is what you will thank yourself for in six months.
3. Their rail now shows the advisor unlocked the next time they load the app.

To end a comp, revoke it from the same screen. The row stays, marked `REVOKED`, so the history is intact.

## Map a new Kajabi offer

1. Get the offer id. The reliable way is to let Kajabi send one real event: Admin > Kajabi shows every event that arrived, and an event whose offer is not mapped shows the error "offer 123 is not mapped" and a "Map this offer" link. The manual way is Kajabi > Products > Offers, open the offer, and read the number in the address bar after `/offers/`.
2. "Map this offer" takes you to Admin > Advisors. Open the advisor the offer should unlock and paste the offer id into its Kajabi offer ids (one per line). For a bundle, do the same on Admin > Suites. One offer can be on several things: every specialist plan includes Evren, so a Lyra offer id goes on Lyra **and** on Evren.
3. Back in Admin > Kajabi, press "Replay" on the event if a real purchase already arrived while the offer was unmapped. Replay runs the stored payload through the same code the webhook uses, so the person gets the access they paid for and the row's result updates.

## Add a sixth advisor

No code changes, but one database step, because Admin edits advisors and does not yet create them. Roughly an hour once the voice and questions are written.

1. Create the row. Two ways, pick one:
   - SQL, from any Postgres client connected with the production `DATABASE_URL`. The slug is lower case, appears in URLs, and cannot change later:

     ```sql
     INSERT INTO "Advisor" (id, slug, name, title, tagline, description, "systemPrompt", "neverSay", "onboardingQuestions", model, "monthlyTokenCap", "sortOrder", "isActive", "kajabiOfferIds", "createdAt", "updatedAt")
     VALUES (gen_random_uuid()::text, 'sixth', 'Sixth', 'Her title', 'One line tagline.', 'A paragraph.', 'Prompt to be replaced in Admin.', '{}', '[]', 'claude-sonnet-5', 600000, 6, false, '{}', now(), now());
     ```

   - Or add her to the `advisors` array in `prisma/seed.ts` and run `npm run db:seed` against production. The seed upserts by slug, so the existing five are left as they are. One caution: the seed also resets every suite's member list to what the seed says, so if she has already been added to a suite in Admin, add her to the seed's suite members too before running it.
2. Admin > Advisors, open her, and paste the real system prompt. Look at the existing five for the shape: lane, themes, how she works. Add her never say lines; the house rules are already applied to everyone.
3. Add three to five onboarding questions. These are asked once, the first time a subscriber opens her, and the answers go into the shared profile.
4. Set the model and the monthly token cap. Match the cap to the price of her offer; see "Monthly cost review" for the arithmetic.
5. Map her Kajabi offer ids (above), and add her offer id to Evren as well if her plan includes Evren.
6. Add her to any suite she belongs to: Admin > Suites, tick her in that suite's Members, save.
7. Switch her active on Admin > Advisors. She now appears in every subscriber's rail, locked until they have an entitlement.
8. Upload any knowledge documents scoped to her slug on Admin > Knowledge, or leave the scope empty for material every advisor should read.

A "New advisor" form in Admin is a small addition if Erica wants it; everything the form would write already has a field on the edit screen.

## Change a price

Prices are not in this app. They are on the Kajabi offer. Kajabi > Products > Offers > the offer > Pricing. Existing subscribers keep the price they signed up at unless Kajabi is told otherwise; that is Kajabi's behaviour, not ours.

The only price related thing here is the token cap on the advisor or suite, which you may want to move if the price moves a long way.

## Back up and restore the database

**Automatic.** Railway takes daily backups of the Postgres volume when backups are switched on for the service (Postgres service > Backups). Confirm they are on. They are kept for a limited window, so they are for "yesterday went wrong", not for history.

**Manual, before anything risky.** From a machine with `pg_dump` installed and the production `DATABASE_URL`:

```bash
pg_dump "$DATABASE_URL" --no-owner --format=custom --file hoa-$(date +%F).dump
```

Keep the file somewhere that is not Railway. Once a month is a sensible rhythm even when nothing is planned.

**Restore from a Railway backup.** Postgres service > Backups > choose a backup > Restore. Railway restores into the same volume, which replaces the current data. Take a manual dump first so the current state is not lost if the restore was the wrong call.

**Restore from a manual dump.**

```bash
pg_restore --no-owner --clean --if-exists --dbname "$DATABASE_URL" hoa-2026-09-02.dump
```

`--clean` drops and recreates objects, so run this only against the database you mean to overwrite.

**Test a restore.** Do this once after go live and again whenever the schema changes materially, so the day you need it is not the first time you have tried it.

1. Create a second Postgres service in Railway from the same template (it needs pgvector).
2. `pg_restore` the latest dump into it.
3. Point a Vercel preview deployment at it by setting `DATABASE_URL` in the Preview environment.
4. Sign in on the preview, open an advisor, check a conversation loads, and compare row counts with production: `SELECT count(*) FROM "User"; SELECT count(*) FROM "Message";`.
5. Delete the second service.

Schema changes are migrations in `prisma/migrations/`. Never edit an existing migration; add a new one with `npx prisma migrate dev --name what_changed` and let `prisma migrate deploy` apply it on the next deploy.

## When chat stops answering

Work down this list. Most incidents are the first two.

1. **Health.** Open `https://app.houseofalchemie.ai/api/health`. `database: error` means Railway; check the service status and the connection string. `integrations.ai: false` means `ANTHROPIC_API_KEY` is missing in Vercel.
2. **The error the subscriber saw.** The chat API returns a code with every failure: `AI_NOT_CONFIGURED` (key missing), `OVER_CAP` (that person has used their month; the message tells them when it resets), 403 (they do not have that advisor; check their entitlements in Admin > Users), 401 (signed out; ask them to sign in again).
3. **Anthropic status.** https://status.anthropic.com. If Anthropic is down, there is nothing to fix here. Tell subscribers, wait.
4. **The key.** In the Anthropic console, check the key still exists and the organisation has credit. A key that works in `/api/health` but fails at request time is usually an exhausted balance or a rate limit; the Vercel function logs show the provider's message.
5. **Vercel logs.** Project > Logs, filter to `/api/chat`. A 500 there is a bug; the log line has the stack.
6. **Model name.** Each advisor has a `model` field. If a model is retired, every request for that advisor fails with a provider error. Change the model in Admin > Advisors.

## Read the Kajabi event log

Admin > Kajabi lists the last hundred webhook calls, newest first: when each arrived, the event type as normalised, the member email, the offer id, and the result (`granted Evren`, `revoked 1 entitlement(s) for Evren`, `offer 123 is not mapped`, `ignored event type "form.submitted"`). Filter chips at the top switch between All, Errors and Unprocessed. Each row has a "Payload" disclosure that shows the raw JSON exactly as Kajabi sent it, and a "Replay" button.

The same page shows the full webhook URL, secret included, with a Copy URL button, so nobody has to assemble it by hand.

Things to know when reading it:

- A row with no email or no offer id could not be applied. It usually means the wrong event was sent, or a forwarder was set up without those fields. The raw payload tells you which.
- "Not mapped" rows have a "Map this offer" link to Admin > Advisors. Map the id there, come back, press Replay.
- `ignored` is normal for events that are not purchases or cancellations.
- A person who bought but says they have no access: the log has no search box, so use your browser's find on the page (the last hundred events are all on it) or check their account in Admin > Users. No row means Kajabi never called us (check the webhook URL and the token). A row with an error means we could not apply it, and the error says why.

The log is also the audit trail. Nothing in it is ever deleted.

## Monthly cost review

Fifteen minutes on the first of the month.

1. **Anthropic console.** Usage for the previous month in dollars. Compare with Admin > Usage, which sums `costMicros` from the ledger for the same period. They should agree within a few percent; the ledger is an estimate from the `usage.pricing` setting. If they drift apart, update the pricing setting to the current rates.
2. **Per subscriber.** Admin > Usage shows tokens and cost per person and per advisor. Anyone at the cap every month is either an outlier to talk to or a signal the cap is too low for the price. Anyone costing more than their subscription is exactly what the cap exists to prevent; check the cap on that advisor or suite.
3. **Voyage.** Only spends money when documents are ingested or questions are asked with a `READY` library. Should be small.
4. **Resend.** Free tier covers a few thousand emails a month. Check you are not near it.
5. **Vercel and Railway.** Both invoice by usage. Railway's number moves with database size and compute; Vercel's with traffic. Neither should surprise you at the subscriber counts in the running costs document (about $580 a month all in at 100 subscribers).
6. **Write the four numbers down** somewhere Erica sees them. The point of the review is that she never discovers a cost from a card statement.
