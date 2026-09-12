import Link from "next/link";
import type { CSSProperties } from "react";
import { getProducts } from "@/lib/products";
import { getActiveOrderCount } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getStoreStatus } from "@/lib/store-hours";
import { getProductOfTheDay, isNewProduct } from "@/lib/product-of-day";
import { fallingPetals, groundPetals } from "@/lib/petals";
import ReorderCard from "@/components/ReorderCard";
import Reveal from "@/components/Reveal";

// Stock counts, order queue, and open/closed status all need to be read
// fresh on every request once Supabase is wired up, not baked in once at
// build time.
export const dynamic = "force-dynamic";

function estimateWaitMinutes(activeOrders: number): number {
  return Math.min(15 + activeOrders * 4, 40);
}

// A single soft, rounded flower petal — a radial gradient from a pale
// center to a pink edge, plus a gently curved vein — modeled on real
// scattered rose/blossom petals rather than a symmetric flower icon (which
// reads as a star at small sizes). Each instance needs its own gradient id
// since many of these render on one page.
function Petal({ id, colorA, colorB, className, style }: { id: string; colorA: string; colorB: string; className: string; style: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 28" className={className} style={style}>
      <defs>
        <radialGradient id={id} cx="38%" cy="28%" r="80%">
          <stop offset="0%" stopColor={colorA} />
          <stop offset="100%" stopColor={colorB} />
        </radialGradient>
      </defs>
      <path
        d="M12 27C4 22 1 13 5 6C7.5 1.5 16.5 1.5 19 6C23 13 20 22 12 27Z"
        fill={`url(#${id})`}
        stroke={colorB}
        strokeOpacity="0.3"
        strokeWidth="0.5"
      />
      <path
        d="M12 23C9.5 18 9.8 10 12 5"
        fill="none"
        stroke={colorB}
        strokeOpacity="0.4"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
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
      {/* Hero — clean white background with small apple-blossom petals
          drifting down and collecting along the bottom edge (see
          lib/petals.ts + the .petal* rules in globals.css). */}
      <section className="relative overflow-hidden bg-paper text-ink">
        <div className="petal-field" aria-hidden="true">
          {fallingPetals(18).map((p, i) => (
            <Petal
              key={`petal-fall-${i}`}
              id={`petal-grad-fall-${i}`}
              colorA={p.colorA}
              colorB={p.colorB}
              className="petal petal-fall"
              style={p.style}
            />
          ))}
          {groundPetals(110).map((p, i) => (
            <Petal
              key={`petal-ground-${i}`}
              id={`petal-grad-ground-${i}`}
              colorA={p.colorA}
              colorB={p.colorB}
              className="petal petal-ground"
              style={p.style}
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
