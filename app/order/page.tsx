import type { Metadata } from "next";
import { after } from "next/server";
import { maybeAutoSyncClover } from "@/lib/clover-autosync";
import { getStorefrontProducts } from "@/lib/products";
import { getStorefrontCategories } from "@/lib/categories";
import OrderCatalog from "@/components/OrderCatalog";
import PageHero from "@/components/PageHero";
import DeliveryAreas from "@/components/DeliveryAreas";
import { NEIGHBORHOODS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Order Online — Pickup or Delivery in Woodley Park & Cleveland Park",
  description: `Order snacks, drinks, groceries, wine & beer and everyday essentials from Manhattan Market online. Pickup in about 15 minutes at 2647 Connecticut Ave NW, or delivery by Uber to ${NEIGHBORHOODS.slice(0, 5).join(", ")} and nearby DC neighborhoods.`,
  alternates: {
    canonical: "/order",
  },
};

// Fetched fresh on every request, same as the homepage — so the menu (and
// what search engines see in the page's initial HTML) always matches live
// inventory instead of a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function OrderPage({ searchParams }: PageProps<"/order">) {
  // Keep the menu in step with Clover (API-token mode) — runs after the
  // page is sent, at most every few minutes. See lib/clover-autosync.ts.
  after(maybeAutoSyncClover);
  const [products, categories] = await Promise.all([getStorefrontProducts({ inStockOnly: true }), getStorefrontCategories()]);

  // Only ever show what's actually in stock — the site should always match
  // the live inventory, so a sold-out item just isn't on the menu rather
  // than sitting there unbuyable.
  const inStock = products.filter((p) => p.stock > 0);

  // From the homepage: /order?q=milk (search) or /order?aisle=Drinks.
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const initialSearch = one(params.q).slice(0, 80);
  const initialAisle = one(params.aisle).slice(0, 60);

  return (
    <div>
      <PageHero
        eyebrow="Order online · open 9am–9pm daily"
        title={
          <>
            Pickup or delivery — <span className="text-gold">your call.</span>
          </>
        }
        subtitle="Everything below is in stock on our shelves right now. Pick it up at the counter in about 15 minutes, or have it delivered by Uber."
      >
        <div className="flex flex-wrap gap-2">
          {["Ready in ~15 min", "Delivered by Uber", "Wine & beer for pickup (21+)"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-wide text-white"
            >
              {t}
            </span>
          ))}
        </div>
      </PageHero>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <OrderCatalog products={inStock} categories={categories} initialSearch={initialSearch} initialAisle={initialAisle} />

        <section className="mt-16 rounded-[2rem] border-2 border-ink bg-green-tint p-6 sm:p-8">
          <DeliveryAreas />
        </section>
      </div>
    </div>
  );
}
