# Kajabi and the platform: how it is connected and what to expect

Erica, this is the plain language version of how your Kajabi checkouts feed the platform. It was all wired up on 2 September 2026 and tested end to end, including a test message sent from Kajabi's own servers, so there is nothing for you to set up. This tells you what happens on its own, the three things that still need a hand, and how to check on any of it.

## The short version

- Someone buys any of your twelve offers on Kajabi. Within a minute the platform creates their account (or finds it), unlocks the right advisor or suite, and emails them a set password link from hello@houseofalchemie.ai.
- Every monthly payment keeps their access open for another month, plus a week of grace for Kajabi's payment retries.
- When they cancel, Kajabi keeps them in until the end of the month they paid for and stops charging. No payment, no renewal: the advisor locks.
- You change nothing in Kajabi for any of this. Prices, coupons, trials and checkout pages are Kajabi's business and the platform never needs to know.

## What is set up in Kajabi

Settings > Integrations & Webhooks > Webhooks has two entries, both pointing at the platform:

| Kajabi event | When it fires | What the platform does |
| --- | --- | --- |
| Payment Succeeded | Every successful charge: a first purchase, a monthly renewal, a trial converting | Unlocks what that offer includes, or extends it |
| Cart Purchase | An order from the Kajabi Cart, which can hold several offers | Unlocks every offer in the order |

Please leave those two rows alone. Deleting one silently stops new purchases from getting in. If that ever happens by accident, tell me and I will put it back in two minutes. The address they point at contains a secret, so it should not be pasted anywhere else.

## The twelve offers and what each unlocks

| Kajabi offer | Unlocks |
| --- | --- |
| Evren, The Priceless Concierge | Evren |
| Lyra, The Freedom Catalyst, and Lyra, 7 Day Trial | Lyra and Evren |
| Lumi, The Wealth Architect, and Lumi, 7 Day Trial | Lumi and Evren |
| Rune, The Luxury Closer, and Rune, 7 Day Trial | Rune and Evren |
| Auren, The Social Alchemist, and Auren, 7 Day Trial | Auren and Evren |
| The Lifestyle Architect | Evren, Lumi and Lyra |
| The Alchemie of Influence | Evren, Rune and Auren |
| The House of Alchemie | All five |

The offer called "OLD Rune broken do not use" is deliberately not connected.

## How long access lasts

Kajabi tells the platform when money comes in. It does not tell anyone when a subscription is cancelled, refunded or stops paying. That is a limit of Kajabi, not a choice we made: Zapier cannot see it either, and the Kajabi feature that could report it is only on their Pro plan. So the platform does not wait to be told. Each payment buys a window of access:

| Payment | Access from that payment |
| --- | --- |
| A monthly plan | 38 days: the month plus 7 days for Kajabi's retries |
| A $0 payment, which is a free trial starting | 10 days: the 7 day trial plus 3 |
| A one time offer | No end date |

Each renewal pushes the window out again, so a paying subscriber never notices any of this. The numbers live in Admin > Settings > Kajabi access windows, in case a plan ever changes to annual, say.

## The three things that need a hand

1. **Removing someone straight away.** A refund on day one, or anyone you want out now. Admin > Users > the person > Revoke. Instant.
2. **Giving access without a purchase.** A gift, a partner, a VIP. Admin > Users > the person > Grant, choose the advisor or suite, and an end date if you want one. Kajabi never knows about it and never takes it away, which is the point.
3. **A new offer in Kajabi.** Create it in Kajabi as usual, then in Admin > Advisors (or Admin > Suites) paste the offer id into the Kajabi offer ids box of everything it should unlock. A specialist plan goes on that advisor and on Evren. The id is the number in the address bar when the offer is open in Kajabi. If you forget, the first purchase shows in Admin > Kajabi with a "Map this offer" link: map it, press Replay, and the buyer is in.

## A trial that starts at $0

Kajabi should send a Payment Succeeded for the $0 charge when a 7 day trial starts, which opens the 10 day window; the first real charge on day 7 extends it to a full month. Kajabi's documentation does not say this in so many words, so the first trial signup is the proof: look in Admin > Kajabi that day. If nothing arrived, tell me and I will handle trials another way. Nobody is left out in the meantime, because you can grant them from Admin.

## Checking on it

Admin > Kajabi lists every message Kajabi has ever sent, newest first: when it arrived, what kind it was, the email, the offer, and what the platform did with it, for example "granted Lyra, Evren until 10 Oct 2026", "renewed Lyra, Evren until 9 Nov 2026" or "already had Lyra, Evren". A row highlighted in red needs attention and the note says why. Nothing in that list is ever deleted.

Admin > Users shows each person, what they have, and the end date of each window. Every night the platform marks windows that have closed as expired, so this screen always reflects who is in.

## The acceptance check from our agreement

Do this once with a real card and an email address you have never used on the platform. About ten minutes.

1. Buy the cheapest offer, or a trial.
2. Within a minute, Admin > Kajabi shows a row for it with a result beginning "granted".
3. The set password email arrives at that address from hello@houseofalchemie.ai. Open it, choose a password, answer the intake questions, and ask the advisor something.
4. Admin > Users > that account shows the advisor with an end date about 38 days out (10 for a trial).
5. Cancel that subscription in Kajabi so you are not charged again. Kajabi sends nothing for a cancellation, and that is expected: access ends on the end date. To see it lock straight away, press Revoke in Admin, then sign in as that account. The advisor is locked, with a link back to your sales page.
6. Keep the account. It is the quickest way to check anything later.

## If something looks wrong

- A buyer says they have no access: open Admin > Kajabi and find their email. No row means Kajabi did not call us, so check the two webhooks are still there. A red row says what was missing. A "granted" row means it worked, so check they used the same email on the platform as at checkout, and that the set password email did not land in spam.
- Anything else: send me a screenshot of the row in Admin > Kajabi and I will take it from there.

## For whoever maintains this

The webhook address is `https://app.houseofalchemie.ai/api/kajabi/webhook?token=SECRET`, shown complete in Admin > Kajabi. Kajabi's native payloads carry `event`, `offer.id`, `offer.type`, `member.email` and `payment_transaction.amount_paid`; Cart orders carry `order_items[]`. If events are ever relayed through another tool, post JSON with `event` (anything containing "purchase" grants, anything containing "cancel" revokes), `email`, `name`, `offer_id` and `member_id`. Every call is stored in full and can be replayed from Admin > Kajabi.
