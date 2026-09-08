import Link from "next/link";
import { getProducts } from "@/lib/products";
import { isSupabaseConfigured } from "@/lib/supabase";

// Stock counts need to be read fresh on every request once Supabase is
// wired up, not baked in once at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 3).length;

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-line bg-green-deep text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24">
          <p className="eyebrow text-gold">Manhattan Market</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold sm:text-5xl">
            Order ahead. Skip the line.
          </h1>
          <p className="mt-4 max-w-xl font-body text-lg text-white/75">
            Hot food, snacks, and everyday essentials — ready for pickup, or delivered
            straight to your door.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/order"
              className="rounded-full bg-gold px-6 py-3 font-mono text-sm font-semibold text-gold-ink transition hover:brightness-95"
            >
              Order Online
            </Link>
            <Link
              href="/rewards"
              className="rounded-full border border-white/30 px-6 py-3 font-mono text-sm font-semibold text-white transition hover:border-white"
            >
              Join Rewards
            </Link>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Order Ahead", body: "Pickup in as little as 15 minutes. Skip the line entirely." },
            { title: "Real Delivery", body: "Through Uber's courier network — no drivers to wait on." },
            { title: "Earn Rewards", body: "Every order counts toward your next free item." },
            { title: "Always Accurate", body: "What you see online matches what's on the shelf." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-line p-5">
              <h3 className="font-body text-base font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 font-body text-sm text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live stock teaser */}
      <section className="bg-panel">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-green">One stock count, everywhere</p>
              <h2 className="mt-2 max-w-lg font-display text-2xl font-bold text-ink sm:text-3xl">
                What's on this site is what's on the shelf
              </h2>
              <p className="mt-2 max-w-lg font-body text-sm text-ink-soft">
                The website reads live from the same inventory system as the register, so
                nothing gets sold online that just sold out in-store — or the other way
                around.
              </p>
            </div>
            <span className="rounded-full border border-green/30 bg-green-tint px-4 py-1.5 font-mono text-xs font-semibold text-green-deep">
              {lowStockCount} item{lowStockCount === 1 ? "" : "s"} running low right now
            </span>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-md border border-line bg-paper px-4 py-3"
              >
                <span className="font-body text-sm text-ink">{p.name}</span>
                <span className="font-mono text-xs font-semibold text-green">{p.stock} left</span>
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">
            {isSupabaseConfigured
              ? "Live from Supabase — place an order and watch these numbers move"
              : "Preview build — these counts will sync live from the Clover terminal"}
          </p>
        </div>
      </section>

      {/* Hours preview */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-lg border border-line p-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-green">Hours &amp; Location</p>
            <p className="mt-2 font-display text-xl font-bold text-ink">
              Open daily · 123 Main Street
            </p>
            <p className="mt-1 font-body text-sm text-ink-soft">
              (placeholder details — real hours and address go here)
            </p>
          </div>
          <Link
            href="/location"
            className="whitespace-nowrap rounded-full border border-line px-5 py-2.5 font-mono text-xs font-semibold text-ink transition hover:border-green hover:text-green"
          >
            Get Directions
          </Link>
        </div>
      </section>
    </div>
  );
}
