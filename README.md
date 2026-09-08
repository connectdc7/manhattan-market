# Manhattan Market — demo site

A working preview of the Manhattan Market online storefront, built on the same
stack as True Doc Pros (Next.js + Supabase + Vercel), so it can go live on
that same workflow once real accounts and credentials are in hand.

## What's real vs. mocked right now

This is a **preview build** meant to show what the finished site looks and
feels like. Everything you can click works — browsing, filtering by
category, adding to cart, adjusting quantities, and walking through
checkout — but three things are intentionally stubbed until the real
integrations are ready:

- **Products & stock** (`lib/products.ts`) — a local list of 12 sample items
  standing in for a live read from Clover's inventory API. In the real build
  this file goes away and the site reads current stock from Supabase, kept
  in sync with the Clover terminal via webhooks.
- **Payments** (`app/checkout/page.tsx`) — "Place Order" simulates a 1.4s
  processing delay and shows a success screen. No card is charged. This is
  where Stripe Checkout will be wired in.
- **Delivery dispatch** — the pickup/delivery toggle at checkout is there,
  but it doesn't yet call Uber Direct to request a courier.
- **Rewards signup** — the form on `/rewards` accepts an entry and shows a
  success state, but nothing is saved to a database yet.

Every page that has a stubbed piece says so in small print, so nothing is
presented as more finished than it is.

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploying

Same flow as True Doc Pros:

1. Push this folder to a new GitHub repo.
2. Import that repo in Vercel (vercel.com/new) — it'll auto-detect Next.js,
   no config needed.
3. Deploy. You'll get a live `*.vercel.app` URL immediately, and can attach
   a real domain later.

## Next steps to go from demo to launch

1. Swap `lib/products.ts` for a Supabase table synced from Clover.
2. Add Stripe Checkout to `app/checkout/page.tsx`.
3. Wire the delivery toggle to the Uber Direct API.
4. Replace placeholder copy — address, hours, photos in `/gallery` — with
   the real thing.
5. Connect the rewards form to a real points ledger.
