# Connecting Kajabi to the platform

Erica, this is the one piece of setup that lives in your Kajabi account rather than in the app, so it needs to be done by you or by someone signed in as you. It takes about twenty minutes the first time. Once it is done, a purchase on any of your checkouts gives that person their advisor within a minute or two, and a cancellation takes it away, with nobody touching anything.

## What we are setting up

Kajabi will send a small message to the platform every time one of two things happens:

1. Someone **buys** one of your offers.
2. Someone's subscription to one of your offers is **cancelled** (including a refund or a failed renewal that Kajabi ends).

The platform reads the message, finds the offer, and grants or removes access. Everything Kajabi sends is kept, so you can always see exactly what happened and when.

## The address to send it to

```
https://app.houseofalchemie.ai/api/kajabi/webhook?token=YOUR_SECRET
```

You do not need to build this yourself. Sign in to the platform, open Admin > Kajabi, and the "Connect Kajabi" box shows the complete address with the secret already filled in and a "Copy URL" button. The secret is what stops anyone else from granting themselves access, so treat the whole address like a password: paste it into Kajabi and nowhere else. If it ever leaks, I can change it in a minute.

## Where in Kajabi

**Done on 2 September 2026.** Settings > Integrations & Webhooks > Webhooks now has two webhooks, both pointing at the address above:

| Kajabi event | What it means | What the platform does |
| --- | --- | --- |
| Payment Succeeded (`payment.succeeded`) | Any successful charge: a first purchase, a monthly renewal, a payment plan instalment | Grants the offer's advisor or suite. A renewal for something the person already holds is a no-op. |
| Cart Purchase (`order.created`) | A Kajabi Cart order, which can hold several offers | Grants every offer in the order. |

One webhook per event covers every offer; there is nothing to do per offer.

**How cancellations work: access follows payments.** Kajabi's webhooks only report money coming in. There is no Kajabi event for a cancelled subscription, a refund or a failed renewal (Zapier has no such trigger either, and Kajabi's API that could report it is a Pro plan feature). So the platform does not wait to be told. Every successful payment buys a window of access:

| What Kajabi sent | Access window |
| --- | --- |
| A payment for a monthly plan | 38 days from that payment: a 31 day month plus 7 days for Kajabi's retries |
| A $0 payment (a free trial starting) | 10 days: the 7 day trial plus 3 |
| A one time offer | No end date |

Each renewal payment pushes the window out again. When someone cancels, Kajabi lets them keep access until the end of the period they paid for and then stops charging; no payment arrives, the window closes, and the advisor locks. A failed renewal that Kajabi's retries never recover ends the same way. The numbers live in Admin > Settings > Kajabi access windows, with a per offer override for anything that is not monthly (an annual plan would be 372).

**Immediate removal**, for example a refund on the day of purchase: Admin > Users > the person > Revoke. That is instant and it is the only case that needs a hand.

Every night the platform marks closed windows as expired, so Admin > Users shows who lapsed.

**If you ever relay through Zapier or Make**, send these fields, spelled exactly like this:

| Field | Purchase Zap | Cancellation Zap |
| --- | --- | --- |
| `event` | `offer_purchased` | `offer_cancelled` |
| `email` | the member's email from the trigger | the member's email from the trigger |
| `name` | the member's name | the member's name |
| `offer_id` | the offer id from the trigger | the offer id from the trigger |
| `member_id` | the member id from the trigger | the member id from the trigger |

The word in `event` matters: anything with "purchase" grants, anything with "cancel" revokes. Send only those two kinds of event. A "payment failed" event would also count as a cancellation, so leave it out unless you want failed payments to remove access immediately.

## Which offers

Every offer that should open an advisor or a suite. At the time of writing that is twelve: the five advisors, the three suites, and the trial versions that are separate offers in Kajabi. A trial offer is its own offer with its own id, so it needs to be mapped as well, or a person on a trial will not get in.

You do not choose offers on the Kajabi side. Kajabi sends every purchase; the platform decides what each offer unlocks from the mapping in Admin.

## Finding an offer id

The easiest way is to not look it up at all: make the first purchase (below) and read it from the event. If you want it by hand: Products > Offers > open the offer. The address bar shows something like `app.kajabi.com/admin/offers/2148123456/edit`. The number is the offer id.

One honest note. The exact shape of what Kajabi sends, including whether the offer id arrives as that number or as a different identifier, is discovered from the first real event. That is why the platform keeps every message in full. Do not spend time guessing; do the test purchase and the Admin screen will show you what arrived.

## Mapping offers in the app

Admin > Advisors > Evren > Kajabi offer ids, one id per line. Add Evren's offer id and her trial offer id, save. Repeat for each advisor. Then Admin > Suites, where each suite has the same Kajabi offer ids box. The Advisors page shows a warning until every advisor has at least one id, so you can see at a glance what is still missing.

Two rules that trip people up:

- Every specialist plan includes Evren. So Lyra's offer id goes on Lyra **and** on Evren. Same for Lumi, Rune and Auren. A suite's offer id goes on the suite only; the suite already knows its members.
- If a purchase arrives for an offer that is not mapped yet, nothing is lost. Admin > Kajabi shows the event with the note "offer 123 is not mapped" and a **Map this offer** link. The link opens Admin > Advisors; paste the id onto the right advisor (or suite), save, go back to Admin > Kajabi and press **Replay** on that event. The purchase is then applied and the row's result changes to "granted".

## Testing with one real purchase

Use a real checkout with a real card of your own, on the cheapest offer or a trial. A $0 or 100 percent coupon purchase also works if Kajabi sends the same purchase event for it, and the Admin screen will tell you whether it did.

1. Buy the offer with an email address you have not used on the platform before.
2. Within a minute, open Admin > Kajabi. You should see one new row: the event type, your email, the offer id, and a result beginning `granted Evren` (or whatever you bought; for a brand new email it also says "created account and sent set password email"). If the result says the offer is not mapped, follow "Mapping offers in the app" above, then press Replay on the row.
3. Check the inbox you bought with. There is an email from House of Alchemie with a set password link. Open it, choose a password, and you are looking at the intake questions, then at your advisor. That is the "buy on Kajabi and use Evren within minutes" check from our agreement, done.
4. Now cancel that subscription in Kajabi: People > the member > the offer > Cancel (or Products > Offers > the offer > the subscriber). Back in Admin > Kajabi you should see a second row with the result `revoked 1 entitlement(s) for Evren`.
5. Sign in as that test account. The advisor is now locked on the advisors page and in the rail, with a link to the sales site. That is the "cancellation removes access" check.

If step 2 shows nothing at all after a couple of minutes, Kajabi did not call us. Check the address in the webhook or Zap, including the token, and that the Zap is switched on. If step 2 shows a row with an error such as "no member email in payload", the message arrived but is missing a field; send me a screenshot of the row and I will adjust the reader.

## Afterwards

- Keep the test account. It is useful every time something changes.
- Any time you add an offer in Kajabi, map it in Admin. If you forget, the first purchase will remind you with a Map this offer link.
- Changing a price is done in Kajabi only. The platform never needs to know.
