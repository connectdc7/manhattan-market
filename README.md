# Manhattan Market — demo site

A working preview of the Manhattan Market online storefront, built on the same
stack as True Doc Pros (Next.js + Supabase + Vercel), so it can go live on
that same workflow once real accounts and credentials are in hand.

## What's real vs. mocked right now

This is a **preview build**, but it's wired up to a real Supabase database —
not just fake data — so it behaves as close to the real thing as possible
before your friend's actual product info and payment setup are in hand.

Real, once Supabase is connected (see setup below):
- **Products & stock** are read live from a Supabase table, not hardcoded in
  the app. Add real inventory later by editing that table.
- **Stock decrements for real** when an order is placed — atomically, in the
  database — so the menu reflects it immediately. This is the same
  mechanism that will eventually keep the website and the Clover terminal in
  sync.
- **Rewards signups** are saved to a real table you can look at in Supabase.

Still mocked, on purpose, because the real credentials aren't available yet:
- **Payments** (`app/checkout/page.tsx`) — "Place Order" simulates a 1.4s
  processing delay and shows a success screen. No card is charged. This is
  where Stripe Checkout will be wired in.
- **Delivery dispatch** — the pickup/delivery toggle at checkout is there,
  but it doesn't yet call Uber Direct to request a courier.

Every page that has a stubbed piece says so in small print, so nothing is
presented as more finished than it is. If Supabase isn't connected at all,
the site still works — it just falls back to a local sample menu instead of
a live database.

## Setting up Supabase (no coding required)

1. Go to supabase.com, sign up / log in, and create a new project (any name,
   any region, set a database password and save it somewhere).
2. Once it's ready, open the **SQL Editor** (left sidebar), click **New
   query**, paste in the entire contents of `supabase/seed.sql` from this
   project, and click **Run**. That creates the `products` and
   `rewards_signups` tables and seeds the same 12 sample items already in
   the app.
3. Go to **Project Settings > API**. You'll need two values from there:
   the **Project URL** and the **anon public** key.
4. In your Vercel project, go to **Settings > Environment Variables** and
   add both:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
5. Redeploy (Vercel > Deployments > ⋯ > Redeploy) so the new environment
   variables take effect.

That's it — no code changes needed. The home page, order page, and rewards
form will automatically start using Supabase once those two variables are
set.

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To test against Supabase locally too, copy
`.env.local.example` to `.env.local` and fill in the same two values.

## Deploying

Same flow as True Doc Pros:

1. Push this folder to a new GitHub repo.
2. Import that repo in Vercel (vercel.com/new) — it'll auto-detect Next.js,
   no config needed.
3. Deploy. You'll get a live `*.vercel.app` URL immediately, and can attach
   a real domain later.

## Next steps to go from demo to launch

1. Replace the seeded sample products in Supabase with the real menu, and
   eventually sync that table automatically from Clover via webhooks.
2. Add Stripe Checkout to `app/checkout/page.tsx`.
3. Wire the delivery toggle to the Uber Direct API.
4. Replace placeholder copy — address, hours, photos in `/gallery` — with
   the real thing.
5. Build a simple admin view (or just use the Supabase table editor) for
   your friend to check rewards signups.
