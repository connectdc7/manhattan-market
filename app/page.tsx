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
        d="M12.91 1.15Q13.00 1.00 13.08 1.16L13.52 1.99Q14.04 2.98 16.34 3.91Q18.29 4.38 18.64 4.85Q18.39 5.47 16.55 6.09Q14.45 7.33 17.34 8.58Q19.59 9.20 20.23 9.82Q19.62 10.46 17.41 11.11Q14.59 12.40 17.85 13.69Q20.28 14.34 21.11 14.98Q20.14 15.52 17.57 16.07Q14.03 17.15 16.54 18.23Q18.60 18.77 19.06 19.32Q18.55 20.00 16.44 20.69Q13.82 22.07 15.49 23.45Q17.12 24.14 17.15 24.83Q17.11 25.18 15.47 25.54Q13.80 26.25 13.40 27.38L13.10 28.23Q13.00 28.50 12.90 28.21L12.60 27.29Q12.20 26.08 10.32 25.28Q8.58 24.89 8.43 24.49Q8.58 23.90 10.33 23.31Q12.22 22.14 9.75 20.96Q7.72 20.37 7.28 19.78Q7.60 19.09 9.52 18.40Q11.76 17.02 8.56 15.63Q6.16 14.94 5.36 14.25Q6.15 13.65 8.55 13.06Q11.75 11.86 9.05 10.67Q6.91 10.07 6.36 9.48Q6.87 8.90 8.98 8.32Q11.59 7.16 9.50 6.01Q7.65 5.43 7.41 4.85Q7.73 4.37 9.65 3.89Q11.89 2.93 12.44 1.97L12.91 1.15Z"
        fill={colorA}
        stroke={colorB}
        strokeOpacity="0.5"
        strokeWidth="0.3"
      />
      <path
        d="M13 2.40L13 27.90M13 4.31L18.64 4.85M13 8.58L20.23 9.82M13 13.02L21.11 14.98M13 16.75L19.06 19.32M13 21.49L17.15 24.83M13 21.20L8.43 24.49M13 17.15L7.28 19.78M13 12.39L5.36 14.25M13 8.29L6.36 9.48M13 4.31L7.41 4.85"
        fill="none"
        stroke={colorB}
        strokeOpacity="0.4"
        strokeWidth="0.45"
        strokeLinecap="round"
      />
      <path d="M12.55 28.50L13 31.10L13.45 28.50Z" fill={colorB} />
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
          {/* Falling leaves are split across two nested elements on
              purpose: the outer span owns position + the vertical fall
              (a GPU-composited `transform`, not `top` — animating `top`
              forces a layout recalculation on every frame, which is
              expensive with this many elements and was making the fall
              look sluggish/near-frozen on phones); the inner <Leaf> owns
              the sway/spin and the green-to-brown color animation. CSS
              custom properties set on the outer span (--x, --size,
              --fall-dur, etc.) inherit down to the inner element, so
              both can reference the same values from lib/petals.ts. */}
          {fallingLeaves(18).map((l, i) => (
            <span key={`leaf-fall-${i}`} className="leaf-fall-wrap" style={l.style}>
              <Leaf colorA={l.colorA} colorB={l.colorB} className="leaf leaf-fall-inner" style={{}} />
            </span>
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
