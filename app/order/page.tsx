import type { Metadata } from "next";
import { getStorefrontProducts } from "@/lib/products";
import { getStorefrontCategoryNames } from "@/lib/categories";
import OrderCatalog from "@/components/OrderCatalog";

export const metadata: Metadata = {
  title: "Order Online — Pickup or Delivery",
  description:
    "Browse hot food, snacks, drinks, and grocery essentials at Manhattan Market and order ahead for pickup or delivery in Woodley Park, Washington, DC.",
  alternates: {
    canonical: "/order",
  },
};

// Fetched fresh on every request, same as the homepage — so the menu (and
// what search engines see in the page's initial HTML) always matches live
// inventory instead of a build-time snapshot.
export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const [products, categories] = await Promise.all([getStorefrontProducts(), getStorefrontCategoryNames()]);

  // Only ever show what's actually in stock — the site should always match
  // the live inventory, so a sold-out item just isn't on the menu rather
  // than sitting there unbuyable.
  const inStock = products.filter((p) => p.stock > 0);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="eyebrow text-green">Order Online</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Pickup or delivery — your call
      </h1>
      <p className="mt-2 max-w-xl font-body text-sm text-ink-soft">
        Sample menu for this preview. Add real products, photos, and pricing before
        launch.
      </p>

      <OrderCatalog products={inStock} categories={categories} />
    </div>
  );
}
