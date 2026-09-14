import Link from "next/link";
import type { CSSProperties } from "react";
import { getProducts } from "@/lib/products";
import { getActiveOrderCount } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getStoreStatus } from "@/lib/store-hours";
import { getProductOfTheDay, isNewProduct } from "@/lib/product-of-day";
import { fallingLeaves, groundLeaves } from "@/lib/petals";
import ReorderCard from "@/components/ReorderCard";
import Reveal from "@/components/Reveal";

// Stock counts, order queue, and open/closed status all need to be read
// fresh on every request once Supabase is wired up, not baked in once at
// build time.
export const dynamic = "force-dynamic";

function estimateWaitMinutes(activeOrders: number): number {
  return Math.min(15 + activeOrders * 4, 40);
}

// A single oak leaf — one fixed lobed outline plus a midrib and side
// veins, reused for every leaf on the page. Only its fill/stroke colors
// (colorA/colorB), size, position, and timing (all driven by
// lib/petals.ts + the CSS custom properties on `style`) differ from one
// instance to the next; the color *change* as a leaf falls is animated
// live in CSS (see .leaf-fall / @keyframes leaf-color in globals.css),
// not baked in here.
function Leaf({ colorA, colorB, className, style }: { colorA: string; colorB: string; className: string; style: CSSProperties }) {
  return (
    <svg viewBox="0 0 26 32" className={className} style={style}>
      <path
        d="M13.15 2.00C13.60 2.15 14.92 2.62 15.58 2.93C16.23 3.24 16.79 3.55 17.09 3.86C17.38 4.17 17.41 4.48 17.32 4.79C17.24 5.10 16.80 5.40 16.59 5.71C16.38 6.02 16.02 6.33 16.05 6.64C16.08 6.95 16.32 7.26 16.77 7.57C17.23 7.88 18.10 8.19 18.79 8.50C19.48 8.81 20.44 9.12 20.93 9.43C21.43 9.74 21.79 10.05 21.75 10.36C21.71 10.67 21.22 10.98 20.71 11.29C20.20 11.60 19.26 11.90 18.71 12.21C18.16 12.52 17.54 12.83 17.41 13.14C17.28 13.45 17.51 13.76 17.93 14.07C18.36 14.38 19.29 14.69 19.96 15.00C20.62 15.31 21.53 15.62 21.92 15.93C22.31 16.24 22.49 16.55 22.29 16.86C22.09 17.17 21.38 17.48 20.72 17.79C20.06 18.10 18.98 18.40 18.33 18.71C17.68 19.02 17.02 19.33 16.80 19.64C16.58 19.95 16.74 20.26 17.01 20.57C17.28 20.88 18.00 21.19 18.43 21.50C18.86 21.81 19.45 22.12 19.61 22.43C19.76 22.74 19.68 23.05 19.36 23.36C19.04 23.67 18.31 23.98 17.70 24.29C17.09 24.60 16.23 24.90 15.68 25.21C15.13 25.52 14.67 25.83 14.39 26.14C14.12 26.45 14.21 26.76 14.00 27.07C13.80 27.38 13.34 27.85 13.15 28.00C12.96 28.15 13.11 28.15 12.85 28.00C12.59 27.85 11.83 27.38 11.61 27.07C11.40 26.76 11.69 26.45 11.57 26.14C11.46 25.83 11.32 25.52 10.93 25.21C10.54 24.90 9.85 24.60 9.22 24.29C8.58 23.98 7.68 23.67 7.13 23.36C6.59 23.05 6.08 22.74 5.96 22.43C5.84 22.12 6.09 21.81 6.43 21.50C6.76 21.19 7.52 20.88 7.97 20.57C8.43 20.26 9.02 19.95 9.14 19.64C9.25 19.33 9.09 19.02 8.67 18.71C8.26 18.40 7.35 18.10 6.64 17.79C5.92 17.48 4.90 17.17 4.38 16.86C3.86 16.55 3.48 16.24 3.53 15.93C3.58 15.62 4.12 15.31 4.69 15.00C5.25 14.69 6.28 14.38 6.92 14.07C7.56 13.76 8.29 13.45 8.52 13.14C8.76 12.83 8.64 12.52 8.32 12.21C8.00 11.90 7.18 11.60 6.61 11.29C6.04 10.98 5.21 10.67 4.87 10.36C4.53 10.05 4.38 9.74 4.58 9.43C4.78 9.12 5.44 8.81 6.07 8.50C6.69 8.19 7.68 7.88 8.32 7.57C8.96 7.26 9.60 6.95 9.90 6.64C10.20 6.33 10.18 6.02 10.11 5.71C10.04 5.40 9.62 5.10 9.48 4.79C9.33 4.48 9.11 4.17 9.23 3.86C9.36 3.55 9.64 3.24 10.24 2.93C10.84 2.62 12.37 2.15 12.85 2.00C13.33 1.85 12.70 1.85 13.15 2.00Z"
        fill={colorA}
        stroke={colorB}
        strokeOpacity="0.5"
        strokeWidth="0.35"
      />
      <path
        d="M13 3L13 28M13 7.79L21.72 10.13M13 14.29L22.39 16.63M13 20.79L19.58 23.13M13 7.22L4.51 9.56M13 13.72L3.53 16.06M13 20.22L6.03 22.56"
        fill="none"
        stroke={colorB}
        strokeOpacity="0.4"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <path d="M12.5 28L13 31L13.4 28Z" fill={colorB} />
    </svg>
  );
}

export default async function Home() {
  const [products, activeOrders] = await Promise.all([getProducts(), getActiveOrderCount()]);
  const status = getStoreStatus();

  // Only ever promote what's actually sellable right now — a special banner
  // for something that just sold out would be worse than not showing one.
  const specials = products.filter((p) => p.is_special && p.stock > 0);
  const productOfDay = getProductOfTheDay(products);
  const productOfDayIsNew = productOfDay ? isNewProduct(productOfDay) : false;

  return (
    <div>
      {/* Hero — clean white background with small oak leaves drifting
          down, turning from green to gold to brown as they fall, and
          collecting along the bottom edge already brown (see
          lib/petals.ts + the .leaf* rules in globals.css). */}
      <section className="relative overflow-hidden bg-paper text-ink">
        <div className="leaf-field" aria-hidden="true">
          {fallingLeaves(18).map((l, i) => (
            <Leaf
              key={`leaf-fall-${i}`}
              colorA={l.colorA}
              colorB={l.colorB}
              className="leaf leaf-fall"
              style={l.style}
            />
          ))}
          {groundLeaves(110).map((l, i) => (
            <Leaf
              key={`leaf-ground-${i}`}
              colorA={l.colorA}
              colorB={l.colorB}
              className="leaf leaf-ground"
              style={l.style}
            />
          ))}
        </div>
        <div className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <p className="eyebrow text-pink-deep">Manhattan Market</p>
          <h1 className="mt-3 max-w-2xl font-display text-5xl font-bold leading-[1.05] sm:text-6xl">
            <span className="hero-line">Order ahead.</span>
            <br />
            <span className="hero-line hero-line-pop italic text-green">Skip the line.</span>
          </h1>
          <p className="mt-5 max-w-xl font-body text-lg text-ink-soft">
            Hot food, snacks, and everyday essentials — ready for pickup, or delivered
            straight to your door.
          </p>

          {isSupabaseConfigured && (
            <p className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wide text-ink-soft">
              <span className="relative flex h-2 w-2">
                {status.isOpen && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-deep opacity-75" />
                )}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${status.isOpen ? "bg-pink-deep" : "bg-ink/25"}`} />
              </span>
              {status.isOpen ? (
                <>
                  Open now · closes {status.closesAt}
                  {activeOrders > 0 && ` · ~${estimateWaitMinutes(activeOrders)} min for pickup`}
                </>
              ) : (
                <>Closed now · opens {status.opensAt}{status.opensDay !== "today" ? ` ${status.opensDay}` : ""}</>
              )}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/order"
              className="rounded-full bg-pink-deep px-6 py-3 font-mono text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0 active:scale-95"
            >
              Order Online
            </Link>
            <Link
              href="/rewards"
              className="rounded-full border border-line px-6 py-3 font-mono text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-pink-deep hover:text-pink-deep active:translate-y-0 active:scale-95"
            >
              Join Rewards
            </Link>
          </div>
        </div>
      </section>

      {/* Product of the Day — rotates automatically each store-local day
          among healthy, reasonably-priced, newer products (see
          lib/product-of-day.ts). Only renders when something qualifies. */}
      {productOfDay && (
        <Reveal>
          <section className="border-b border-line bg-paper text-ink">
            <div className="mx-auto max-w-6xl px-5 py-14">
              <p className="eyebrow text-green">Product of the Day</p>
              <h2 className="mt-2 max-w-lg font-display text-2xl font-bold sm:text-3xl">
                New, healthy, and easy on your wallet
              </h2>
              <p className="mt-2 max-w-lg font-body text-sm text-ink-soft">
                Every day we spotlight something fresh from the shelf that&apos;s good for
                you and priced fair — today, it&apos;s this.
              </p>

              <div className="mt-8 flex flex-col gap-6 overflow-hidden rounded-lg border border-line bg-pink-tint text-ink shadow-sm sm:flex-row">
                <div className="relative sm:w-64 sm:shrink-0">
                  {productOfDay.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={productOfDay.image_url}
                      alt={productOfDay.name}
                      className="h-48 w-full object-cover sm:h-full"
                    />
                  ) : (
                    <div
                      className="flex h-48 items-center justify-center font-mono text-[0.65rem] uppercase tracking-widest text-white/70 sm:h-full"
                      style={{ backgroundColor: productOfDay.swatch }}
                    >
                      sample photo
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-center gap-3 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="stamp-badge bg-green-tint font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-green-deep">
                      Healthy Pick
                    </span>
                    {productOfDayIsNew && (
                      <span className="stamp-badge bg-gold-tint font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-gold-ink">
                        New
                      </span>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-xl font-bold text-ink">{productOfDay.name}</h3>
                    <span className="price-tag price-tag-gold shrink-0 font-mono text-sm font-semibold text-gold-ink">
                      ${productOfDay.price.toFixed(2)}
                    </span>
                  </div>
                  <p className="font-body text-sm text-ink-soft">{productOfDay.blurb}</p>
                  <Link
                    href={`/order#product-${productOfDay.id}`}
                    className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-green px-5 py-2.5 font-mono text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-green-deep active:translate-y-0 active:scale-95"
                  >
                    Order it now →
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* Today's Specials — ticket style */}
      {specials.length > 0 && (
        <Reveal>
          <section className="border-b border-line bg-gold-tint">
            <div className="mx-auto max-w-6xl px-5 py-8">
              <p className="eyebrow text-gold-ink">Today&apos;s Specials</p>
              <div className="mt-4 flex flex-wrap gap-4">
                {specials.map((p) => (
                  <span key={p.id} className="font-body text-sm text-ink">
                    {p.name}{" "}
                    <span className="price-tag price-tag-gold ml-1 font-mono text-xs font-semibold text-gold-ink">
                      ${p.price.toFixed(2)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <div className="receipt-perforation" />
          </section>
        </Reveal>
      )}

      <ReorderCard />

      {/* Feature grid */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Order Ahead", body: "Pickup in as little as 15 minutes. Skip the line entirely." },
              { title: "Real Delivery", body: "Through Uber's courier network — no drivers to wait on." },
              { title: "Earn Rewards", body: "Every order counts toward your next free item." },
              { title: "Always Accurate", body: "What you see online matches what's on the shelf." },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-line p-5 transition-all duration-300 hover:-translate-y-1 hover:border-green hover:shadow-md"
              >
                <h3 className="font-body text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 font-body text-sm text-ink-soft">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* Hours preview */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-lg border border-line p-8 sm:flex-row sm:items-center">
            <div>
              <p className="eyebrow text-green">Hours &amp; Location</p>
              <p className="mt-2 font-display text-xl font-bold text-ink">
                Open daily · 3706 Connecticut Ave NW
              </p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Washington, DC 20008 · (202) 460-1405
                <br />
                <span className="text-ink-soft/70">(hours below are a placeholder, pending confirmation)</span>
              </p>
            </div>
            <Link
              href="/location"
              className="whitespace-nowrap rounded-full border border-line px-5 py-2.5 font-mono text-xs font-semibold text-ink transition-all hover:-translate-y-0.5 hover:border-green hover:text-green active:translate-y-0 active:scale-95"
            >
              Get Directions
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
