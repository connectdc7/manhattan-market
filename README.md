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
  database — so the menu reflects it immediately.
- **Rewards signups** are saved to a real table you can look at in Supabase.
- The **storefront** does more than list products:
  - the **order page only ever shows what's actually in stock** — a product
    reads straight from the live Supabase count on every page load, and the
    moment it hits zero it drops off the menu instead of sitting there
    unbuyable. Low-stock items ("Only 3 left") still show and still sell —
    only a true zero hides something
  - a live **open/closed status** in the hero, with an estimated pickup wait
    based on how many orders are actually in the queue right now
  - **"Today's Specials"** — whatever staff flag from the dashboard shows in
    a banner automatically (as long as it's still in stock), no redeploy
    needed
  - **"Product of the Day"** — automatically spotlights one healthy,
    reasonably-priced, recently-added product on the homepage, and links
    straight to it on the order page. Rotates once per day on its own — see
    "How Product of the Day works" below for the details and how staff mark
    a product eligible
  - **reorder your last order** in one click — remembered per-browser, no
    account required
  - an optional phone number at checkout to get a text the moment staff mark
    the order Ready — see "Connecting order-ready texts" below
- **An employee dashboard** at `/dashboard` — not linked anywhere in the site
  nav, so a customer browsing the storefront has no way to find or click into
  it; staff reach it directly by URL (bookmark it). The dashboard itself has
  a "View Storefront" link back to the homepage, so staff can check what
  customers see without leaving the dashboard in a second tab. There's no
  login yet (see the security note below) — that's what actually keeps
  `/dashboard` staff-only long-term; not being linked just keeps a customer
  from stumbling onto it by accident. Updates live with no manual refresh
  (new orders and stock changes just appear), and has:
  - a stat row (today's sales, orders, low-stock count, new signups)
  - a **"View Storefront"** button that opens the live site in a new tab,
    so staff can jump back and forth without losing their place
  - inventory with search, category filters, sort-by-low-stock, quick
    +/− stock buttons, and full product management — **Add Product** to
    put a brand-new item on the menu, and **Edit** on any row to change its
    name, category, price, description, or photo (staff pick a photo from
    their phone or computer; it uploads straight to Supabase Storage), or
    remove a product entirely
  - a **sales-velocity warning** on any item selling fast enough to run out
    soon, even if the raw stock count doesn't look low yet
  - a **"Make Special"** toggle per product, and a **"Mark Healthy Pick"**
    toggle that makes a product eligible for the homepage's "Product of the
    Day"
  - an order workflow — each order moves New → Preparing → Ready →
    Completed as staff click through it, instead of just sitting in a
    static list
  - rewards signups, searchable
  - an **Analytics tab** — best/worst sellers, an hourly sales chart, and a
    today-vs-yesterday comparison, all from the same order data already in
    Supabase
  - a **Clover Sync** panel on the Inventory tab — see "Connecting Clover"
    below. It's built and ready, but does nothing until you connect a real
    Clover account.

  See the security note below before showing anyone this URL or using it
  with real customer data.
- **Stripe Checkout** — once `STRIPE_SECRET_KEY` is set (see "Connecting
  Stripe" below), "Place Order" creates a real Stripe Checkout session and
  redirects there. A webhook (`/api/stripe/webhook`) confirms the payment
  actually went through before the order is recorded and stock is
  decremented — nothing is trusted from the browser. Until that key's set,
  "Place Order" falls back to the old instant mocked order instead.

Still mocked, on purpose, because the real credentials aren't available yet:
- **Delivery dispatch** — the pickup/delivery toggle at checkout is there,
  but it doesn't yet call Uber Direct to request a courier.

Every page that has a stubbed piece says so in small print, so nothing is
presented as more finished than it is. If Supabase isn't connected at all,
the site still works — it just falls back to a local sample menu instead of
a live database.

## How "Product of the Day" works

No cron job, no button to click — it's computed fresh on every homepage
load, so it's always correct with zero moving parts to maintain:

1. **Eligible** = in stock, marked **Healthy Pick** from the dashboard, and
   priced at or below the average price across the whole menu (so
   "reasonably priced" adjusts automatically as prices change, instead of
   being a hardcoded dollar amount).
2. Among eligible products, the **5 most recently added** (by `created_at`)
   form the day's rotation pool — this is what keeps the feature promoting
   new arrivals.
3. Which one shows **today** is picked deterministically from that pool
   using the store's own calendar date (in `America/New_York` — see
   `STORE_TIMEZONE` in `lib/store-hours.ts`) — so it changes once a day, at
   midnight store time, the same for every visitor, without storing
   "today's pick" anywhere.

To make a product eligible: open **Inventory** on the dashboard and click
**"Mark Healthy Pick"** on it. If nothing on the menu is both a Healthy Pick
and in stock, the section just doesn't show — it never displays something
that isn't actually a fair pick that day. The logic lives in
`lib/product-of-day.ts` if you want to tune the thresholds (pool size,
price cutoff, how long something counts as "new").

## Adding real product photos

Every product falls back to a solid-color placeholder tile until it has a
real photo — there's no bulk stock-photo library wired in, on purpose:
sourcing photos from the open web wasn't possible from this build
environment (its network is locked down to a small allowlist for security,
and image hosts like Wikimedia Commons and general stock-photo sites aren't
on it), and using someone else's product photos wouldn't be Manhattan
Market's real inventory anyway. Two ways to add real ones:

- **From the dashboard (fastest, no code)** — open **Inventory**, click
  **Edit** on a product, and choose a photo from your phone or computer. It
  uploads straight to Supabase Storage and shows up on the site immediately.
  This works for all 12 sample products right now.
- **Send me the photos** — attach product photos to our chat and tell me
  which product each one is, and I'll add them to the site for you (or, if
  you'd rather, I can wire in a stock-photo/AI-image step once you tell me
  which source you'd like to use).

## AI photo auto-fill for adding products (optional)

Adding products one at a time — typing the name, picking a category, then
separately attaching a photo — is slow, especially from a phone. The
**Add Product** form in the dashboard's Inventory tab can now shortcut most
of that: choose or take a photo of the item, and the same photo is sent to
Claude (Anthropic's AI) to read the label and guess the product's name and
category, filling those fields in for you. Both stay fully editable — it's
a starting guess, never a final answer — and if the photo doesn't read
clearly, the form says so and just falls back to typing it in by hand like
today.

This is inert (the button still works, it just skips the AI step) until you
add an environment variable in Vercel:

- `ANTHROPIC_API_KEY` — get one from
  [console.anthropic.com](https://console.anthropic.com), under **API
  Keys**. Redeploy after adding it.

A couple of things worth knowing: this only runs when *adding* a brand-new
product (editing an existing one's photo never overwrites its real name or
category), and it only fills in the Name field if you haven't already
started typing one. Price and stock count are never guessed — a label
rarely has the shelf price you're actually charging, and nothing but a
physical count can know how many you have, so those stay exactly as
manual as they are today.

## About the employee dashboard's security

`/dashboard` has no login — that was a deliberate choice to keep this demo
quick to set up. It also isn't linked anywhere in the site's own navigation
(customers browsing the storefront never see a way to it), so reaching it
means typing or bookmarking the URL directly — that's a speed bump, not real
security, since the URL isn't a secret. Once a real login is in place, that's
what actually makes `/dashboard` staff-only — see the fix below. To make it
work without one, `supabase/seed.sql` opens up
read access to orders and rewards signups, and write access to products
(stock, name, price, description, photos, the Special and Healthy Pick
flags — add, edit, and delete), to anyone holding the public "anon" key —
which ships inside the site's own JavaScript, so in practice that means
anyone who finds the page. The `product-photos` storage bucket used for
photo uploads is public for the same reason: anyone can view (and, with the
anon key, upload) a photo there.

That's a fine tradeoff while everything in these tables is placeholder demo
data. It stops being fine the moment real customer phone numbers or emails
are in the rewards or orders tables, or someone could deface the menu.
Before that happens, put a real login in front of
`/dashboard` (Supabase Auth is a natural fit, and mirrors the auth you
already built for True Doc Pros) and tighten the RLS/storage policies in
`supabase/seed.sql` to require it. The same file also opens up update access
on orders (so staff can change an order's status) — same tradeoff, same fix
later.

The two Clover tables (`clover_connections`, `clover_webhook_state`) are the
one deliberate exception — they're locked down, not opened up. No policy
grants the anon key any access to them at all, so the dashboard's own
JavaScript can't read the Clover access token even though it can read
everything else in this database. Only the server-side `/api/clover/*`
routes, using a separate Supabase key that never reaches the browser, can
touch them. See "Connecting Clover" below.

## Customizing the homepage background

The "Order ahead. Skip the line." hero section on the homepage isn't fixed
to one look — from the dashboard's **Homepage** tab, staff can pick one of
six built-in ambient effects (Pink Petals — the original look — Falling
Snow, Golden Autumn Leaves, Warm Coffee Steam, City Bokeh Lights), a plain
background with no animation, or their own uploaded photo or video. The
choice takes effect on the live site immediately, no redeploy needed.

Uploading a photo or video works straight from a phone (the file picker
opens the camera as an option, same as adding a product photo) or from a
computer. Multiple photos and videos can be uploaded into a library, and
whichever one is marked **Set live** is what shows on the homepage; the
rest just sit in the library until picked. A video plays muted and on a
loop, so it works like a moving background rather than something visitors
have to press play on. There's a 60MB size limit per file. When "Your
Photo / Video" is selected but nothing's been uploaded (or set live) yet,
the homepage falls back to a plain background rather than showing
nothing meaningful.

This is stored in two new tables (`hero_settings`, `hero_media`) and a
public `hero-media` storage bucket — see the `hero_settings`/`hero_media`
block in `supabase/seed.sql`. Like the rest of the dashboard, write access
to these is open to anyone holding the anon key (see the security note
above), so this carries the same "put a real login in front of `/dashboard`
before this is customer-facing for real" caveat as everything else here.

## Setting up Supabase (no coding required)

1. Go to supabase.com, sign up / log in, and create a new project (any name,
   any region, set a database password and save it somewhere).
2. Once it's ready, open the **SQL Editor** (left sidebar), click **New
   query**, paste in the entire contents of `supabase/seed.sql` from this
   project, and click **Run**. That creates all the tables the site and
   dashboard use (products, orders, rewards signups, and the Clover ones)
   and seeds the same 12 sample items already in the app.
3. Go to **Project Settings > API**. You'll need two values from there:
   the **Project URL** and the **anon public** key.
4. In your Vercel project, go to **Settings > Environment Variables** and
   add both:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
5. Redeploy (Vercel > Deployments > ⋯ > Redeploy) so the new environment
   variables take effect.

That's it — no code changes needed. The home page, order page, rewards
form, and `/dashboard` will automatically start using Supabase once those
two variables are set. If step 2 (`supabase/seed.sql`) gets updated later —
it's written to be safe to re-run any time you pull a newer version of this
project — just paste the new version in and run it again. (The dashboard's
live-update feature needs the newest version of this file run at least
once — it's what turns on Supabase's Realtime for the three tables. The
photo-upload feature needs it too — it's what creates the `product-photos`
storage bucket. Re-running it is harmless even if you already have data in
there.)

## Connecting Clover (when you're ready)

The dashboard's Inventory tab has a Clover Sync panel already built —
"Connect Clover," "Sync Now," a webhook receiver for live updates, all of
it — but it's inert until you set a few things up. None of this needs to
happen before Friday; the panel just shows "not set up yet" until it does.

This is real work with Clover's own developer tools, not a Manhattan
Market thing, so it involves more than pasting keys into Vercel:

1. Get your friend's Clover login (or your own, if you set one up to
   test with first — Clover gives every developer a free **sandbox**
   account with fake test data, which is a safer way to try this before
   touching the real store's inventory).
2. Go to [docs.clover.com/dev](https://docs.clover.com/dev) and sign up for
   a free Clover Developer account.
3. In the Developer Dashboard, create a new App (any name). Under its
   settings you'll find an **App ID** and an **App Secret** — these are
   what this project calls `CLOVER_APP_ID` and `CLOVER_APP_SECRET`. In that
   same settings screen, add your deployed site's callback address as an
   allowed redirect URL — `https://<your-vercel-domain>/api/clover/callback`
   — Clover refuses to redirect back anywhere that isn't listed there.
4. In your Vercel project's environment variables, add:
   - `CLOVER_APP_ID` and `CLOVER_APP_SECRET` — from step 3.
   - `CLOVER_ENV` — `sandbox` while testing, `production` once you're
     pointing at the real store.
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase, **Project Settings > API**
     (the `service_role` key, a different one from the `anon` key you
     already added — this one must never be marked "public" anywhere).
   - Redeploy so they take effect.
5. Open `/dashboard`, go to Inventory — the Clover panel now says "Ready to
   connect." Click **Connect Clover**, log in as the merchant (your
   sandbox test merchant, or the real store), and approve the connection.
6. Click **Sync Now** once to pull in the existing Clover catalog. From
   then on, the panel shows a webhook URL — paste that into the Clover
   app's settings (under Webhooks) to get live updates instead of needing
   to click Sync every time something changes on the Clover side. Clover
   will send a one-time verification code as part of that setup, which
   also shows up in the panel for you to copy back into Clover's screen.

A few things worth knowing about what this integration does and doesn't do
yet: it's one-way (Clover → this site's product list — stock, price, name,
category), not the other direction, so changes made from `/dashboard`
itself won't push back to Clover. Clover doesn't have an equivalent to this
site's product description, so that stays managed here regardless of
Clover sync. Photos are a little different — see the next section — Clover
has no photo field either, but a synced item with no photo yet can get an
AI-generated placeholder automatically instead of sitting on a plain color
tile. The connection's access token refreshes itself automatically shortly
before it expires, so this shouldn't need attention day to day — if the
panel ever shows disconnected unexpectedly anyway, click Connect Clover
again.

**Categories aren't fixed to Hot Food/Snacks/Drinks/Grocery.** The first
sync pulls in whatever department names actually exist in your friend's
Clover account. One that already matches one of the four above links up
automatically with no action needed. A genuinely new one (say, "Beverages,"
"Candy," "Lottery," "Tobacco") gets created right away too — so the item is
correctly categorized immediately, never dumped into the wrong bucket — but
it starts hidden from the public order page and shows up in a **"categories
from Clover need a quick look"** box at the top of the Inventory tab. From
there you can rename it (e.g. "Beverages" → "Drinks," to match naming
you're already using elsewhere), merge it into an existing category instead
of keeping it separate, or confirm it as its own category and choose
whether it belongs on the online order page — a "Lottery" or "Tobacco"
department is a good example of something you'd likely want tracked in
inventory but never orderable online. This only asks once per new
department name; after that, it's remembered for every future sync.

## AI-generated product & gallery photos (optional)

Any product with no photo — a solid color tile instead of a picture — can
get an AI-generated one instead of sitting there waiting for someone to
upload a real photo. This happens two ways:

- **Automatically, for Clover items.** Clover's catalog has no photo field
  of its own, so an item that syncs in from Clover normally lands with no
  picture at all. The moment a new item arrives (from **Sync Now** or the
  live webhook), an AI image model generates a clean, generic product
  photo from its name and category and saves it as that item's photo.
- **On demand, for everything else.** The Inventory tab has an **"AI
  Photos"** panel with a **"Generate N missing product photos"** button (it
  only shows up when at least one product has none) that sweeps the
  *entire* product list — including items that were added by hand, or that
  predate Clover being connected, which the automatic sync path above
  never sees at all — and generates a photo for every one that's missing
  it. Use this any time you want to catch up a gap, not just for Clover
  items.

The same panel also has a **"Generate gallery photos"** button for the
public `/gallery` page's six scene tiles (Storefront, Hot food counter,
Snack aisle, Coffee station, Drink cooler, Register), which otherwise show
as plain color blocks. **This one is different in an important way: the
Gallery page is supposed to show your actual store**, not a generic item —
so an AI-generated "hot food counter" is a generic stock-photo-style scene,
not a picture of Manhattan Market's real counter. Treat these as a
better-looking placeholder than a color tile, not a finished Gallery page —
swap in real photos of the actual storefront, counter, and shelves before
launch (attach them to our chat any time and I'll place them, or upload
them yourself once a real photo-upload flow exists for that page).

A few things worth knowing:

- **It only fills a gap, never overrides anything.** A product keeps its
  generated photo only until someone uploads a real one from the
  dashboard — a real photo always wins, permanently, and neither the
  automatic Clover path nor the manual button ever touches it again. Same
  idea for a gallery tile: generating one only fills tiles that don't
  already have a photo.
- **The image is deliberately generic, not the real label.** The prompt
  asks the model to avoid reproducing a specific brand's actual logo or
  packaging (it has no way to know what a real "Lay's Classic Chips" bag
  looks like today, and guessing would risk an inaccurate fake label), so
  what comes back is a clean, unbranded version of the product — a
  reasonable stand-in for the shelf, not a substitute for the item's real
  packaging photo.
- **It costs a small amount per image** (a few cents, via OpenAI's image
  API). The automatic Clover path runs with no per-item confirmation step;
  the dashboard button asks for nothing either once you click it, so a
  sweep over a lot of missing photos at once will spend accordingly — the
  button's label always tells you the count before you click it.
- **A sync or a sweep may take a little while** the first time it runs
  against a lot of missing photos, since each image takes a few seconds
  and only a handful generate at once (to stay well within Vercel's
  request time limit) — the result message tells you how many actually
  got one versus failed.

This is inert (Clover sync and both dashboard buttons still work, they
just skip this step) until you add one more environment variable in
Vercel:

- `OPENAI_API_KEY` — get one from
  [platform.openai.com](https://platform.openai.com), under **API keys**.
  Redeploy after adding it.

The Gallery button also needs the `gallery_images` table, which is new —
re-run the latest `supabase/seed.sql` in your Supabase project's SQL
Editor (safe to re-run any time; it won't touch your existing products,
orders, or anything else) if the button's result says it couldn't read the
gallery tile list.

## Connecting Stripe (when you're ready)

Checkout is real once this is set up — a customer's card is actually
charged, through Stripe's own hosted payment page, not this site's own
form. Until then, "Place Order" just runs the old instant mocked order.

1. Create a Stripe account (or, if you already use Stripe for another
   business, create a **separate** account for this one under the same
   login — Stripe's account switcher has a "Create" option for that. A
   Stripe account is tied to one business's payouts and tax reporting, so
   two unrelated businesses shouldn't share one).
2. Start in your new account's **sandbox** (Stripe's term for test mode) —
   no real money moves there, which is the safer way to build and test this
   before ever touching a live card. From **Developers → API keys**, copy
   the **Secret key** (`sk_test_...`) and **Publishable key**
   (`pk_test_...`).
3. In your Vercel project's environment variables, add:
   - `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` — from step 2.
   - Redeploy so they take effect.
4. In Supabase's SQL Editor, run the migration below if you haven't already
   (it's also in `supabase/seed.sql`) — it adds the column the Stripe
   webhook uses to avoid recording the same paid order twice:
   ```sql
   alter table orders add column if not exists stripe_session_id text;

   create unique index if not exists orders_stripe_session_id_idx
     on orders (stripe_session_id)
     where stripe_session_id is not null;
   ```
5. In the Stripe Dashboard, go to **Developers → Webhooks → Add endpoint**.
   Set the URL to `https://<your-vercel-domain>/api/stripe/webhook`, and
   subscribe it to the `checkout.session.completed` event. After creating
   it, click into the endpoint and copy its **Signing secret**
   (`whsec_...`).
6. Add that as `STRIPE_WEBHOOK_SECRET` in Vercel's environment variables,
   and redeploy once more.
7. Test it: add something to the cart, check out, and pay with Stripe's
   test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
   You should land on an "Order placed" confirmation, and the order should
   show up in `/dashboard` with stock already decremented — the same as a
   real payment would, just with fake money.

When you're ready to accept real cards, switch that same Stripe account
from sandbox to live mode, swap in the live secret/publishable keys and a
live-mode webhook (live and sandbox each need their own), and update those
three Vercel env vars.

## Connecting order-ready texts (optional)

The phone field at checkout and the "texted when marked Ready" note in the
dashboard are already wired up; without Twilio connected, that text simply
never sends (nothing else about checkout is affected). To turn it on:

1. Go to [twilio.com](https://twilio.com) and sign up.
2. Buy a phone number to send from (Twilio's console walks you through
   this — a free trial credit usually covers testing).
3. From the Twilio Console's dashboard, copy your **Account SID** and
   **Auth Token**.
4. In Vercel's environment variables, add:
   - `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` — from step 3.
   - `TWILIO_FROM_NUMBER` — the number from step 2, in the form `+15551234567`.
   - Redeploy so they take effect.
5. That's it — customers who leave a phone number at checkout get a text
   the moment staff mark their order Ready.

A trial Twilio account can usually only text numbers you've verified in
the console first — fine for testing, but worth knowing before you wonder
why a real customer didn't get their text. Upgrading the Twilio account
(a few dollars) removes that limit.

## Running it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000. To test against Supabase locally too, copy
`.env.local.example` to `.env.local` and fill in the same two values (and
the Clover, Resend, or Twilio ones, if you're testing those too).

## Deploying

Same flow as True Doc Pros:

1. Push this folder to a new GitHub repo.
2. Import that repo in Vercel (vercel.com/new) — it'll auto-detect Next.js,
   no config needed.
3. Deploy. You'll get a live `*.vercel.app` URL immediately, and can attach
   a real domain later.

## Next steps to go from demo to launch

1. Replace the seeded sample products in Supabase with the real menu — by
   hand for now, or by connecting Clover (see above) and clicking Sync.
2. Connect Stripe (see "Connecting Stripe" above) — the checkout code is
   already built, this is just account setup and env vars.
3. Wire the delivery toggle to the Uber Direct API.
4. Replace placeholder copy — address, photos in `/gallery` — with the real
   thing, and the real hours in `lib/store-hours.ts` (one place that feeds
   both the Hours & Location page and the homepage's live open/closed
   status — including the store's actual timezone, if it's not New York).
5. Put a real login in front of `/dashboard` before anyone but you uses it
   (see the security note above).
