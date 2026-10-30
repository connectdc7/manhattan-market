import Link from "next/link";
import { after } from "next/server";
import { maybeAutoSyncClover } from "@/lib/clover-autosync";
import { getStorefrontProducts, Product } from "@/lib/products";
import { getStorefrontCategories } from "@/lib/categories";
import { getActiveOrderCount } from "@/lib/orders";
import { getStoreStatus } from "@/lib/store-hours";
import { getProductOfTheDay, isNewProduct } from "@/lib/product-of-day";
import { getHeroEffect, getActiveHeroMedia } from "@/lib/hero";
import { getPopularProducts } from "@/lib/popular";
import { getGalleryPhotos } from "@/lib/gallery";
import { AISLES } from "@/lib/aisles";
import { BUSINESS } from "@/lib/site";
import { getStoreSettings } from "@/lib/settings";
import HeroBackground from "@/components/hero/HeroBackground";
import CustomHeroMedia from "@/components/hero/CustomHeroMedia";
import ProductPlaceholder from "@/components/ProductPlaceholder";
import ReorderCard from "@/components/ReorderCard";
import Reveal from "@/components/Reveal";
import PopularRow from "@/components/home/PopularRow";
import MobileOrderBar from "@/components/home/MobileOrderBar";
import DeliveryAreas from "@/components/DeliveryAreas";
import MetroZoo from "@/components/home/MetroZoo";

// Stock, the order queue and open/closed status are read fresh on every request.
export const dynamic = "force-dynamic";

function estimateWaitMinutes(activeOrders: number): number {
  return Math.min(15 + activeOrders * 4, 40);
}

// Each aisle gets its own bold tile color (bodega signage energy).
const AISLE_STYLE: Record<string, { bg: string; text: string; short: string }> = {
  "Hot Food & Coffee": { bg: "#e8743b", text: "#ffffff", short: "Hot Food & Coffee" },
  "Snacks & Candy": { bg: "#f0bd3e", text: "#1d231f", short: "Snacks & Candy" },
  Drinks: { bg: "#3b82b0", text: "#ffffff", short: "Drinks" },
  "Bakery & Breakfast": { bg: "#fbf1d9", text: "#1d231f", short: "Bakery & Breakfast" },
  "Dairy, Fresh & Frozen": { bg: "#cfe6dc", text: "#1d231f", short: "Dairy & Frozen" },
  "Pantry & Grocery": { bg: "#21594a", text: "#ffffff", short: "Pantry & Grocery" },
  "Household & Personal Care": { bg: "#e9e1f4", text: "#1d231f", short: "Household & Care" },
  "Wine & Beer": { bg: "#6b1f3a", text: "#ffffff", short: "Wine & Beer" },
  Other: { bg: "#f2f3ec", text: "#1d231f", short: "Everything Else" },
};

const DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1&destination=2647+Connecticut+Ave+NW+Washington+DC+20008";

function countLabel(n: number) {
  if (n >= 1000) return `${Math.floor(n / 100) * 100}+ items`;
  if (n >= 100) return `${Math.floor(n / 10) * 10}+ items`;
  return `${n} item${n === 1 ? "" : "s"}`;
}

export default async function Home() {
  // Keep the menu in step with Clover — runs after the page is sent.
  after(maybeAutoSyncClover);
  const [products, categories, activeOrders, heroEffect, heroMedia, gallery, settings] = await Promise.all([
    getStorefrontProducts({ inStockOnly: true }),
    getStorefrontCategories(),
    getActiveOrderCount(),
    getHeroEffect(),
    getActiveHeroMedia(),
    getGalleryPhotos(),
    getStoreSettings(),
  ]);
  const welcome = settings.welcomeOffer;
  const status = getStoreStatus();
  const popular = await getPopularProducts(products, 12);
  const specials = products.filter((p) => p.is_special && p.stock > 0).slice(0, 6);
  const productOfDay = getProductOfTheDay(products);
  const productOfDayIsNew = productOfDay ? isNewProduct(productOfDay) : false;

  // Group what's in stock by aisle for the "Shop by aisle" tiles.
  const aisleOf = new Map(categories.map((c) => [c.name, c.aisle as string]));
  const byAisle = new Map<string, Product[]>();
  for (const p of products) {
    const a = aisleOf.get(p.category) ?? "Other";
    byAisle.set(a, [...(byAisle.get(a) ?? []), p]);
  }
  const aisles = (AISLES as readonly string[])
    .filter((a) => byAisle.has(a))
    .map((a) => {
      const list = byAisle.get(a)!;
      const withPhotos = list.filter((p) => p.image_url);
      const pics = [...withPhotos.filter((p) => p.is_special), ...withPhotos].filter(
        (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
      );
      return { name: a, count: list.length, photos: pics.slice(0, 3) };
    });
  const heroChips = aisles.filter((a) => a.name !== "Other").slice(0, 6);

  // Product photos for the hero collage when the store hasn't put its own in rotation.
  const collage = products.filter((p) => p.image_url && !p.age_restricted).slice(0, 4);
  const ambient = heroEffect !== "custom" && heroEffect !== "plain";
  const wait = estimateWaitMinutes(activeOrders);

  // Wine & beer copy only while a 21+ department is on the website (they're
  // hidden for now — turn Beer/Wine back on in Dashboard → Store setup).
  const alcoholOnSale = categories.some((c) => c.ageRestricted);

  const ticker = [
    status.isOpen ? `Open now · until ${status.closesAt}` : "Open daily 9am–9pm",
    `Pickup in ~${wait} min`,
    "Delivered by Uber",
    "2647 Connecticut Ave NW",
    ...(alcoholOnSale ? ["Wine & beer for pickup (21+)"] : ["Hot coffee & breakfast sandwiches"]),
    "Order on the Metro, grab it on the way to the Zoo",
    "Woodley Park · 1 block from the Metro",
  ];

  return (
    <div className="overflow-x-hidden">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-bodega-tiles text-white">
        {ambient && (
          <div className="pointer-events-none absolute inset-0">
            <HeroBackground effect={heroEffect} activeMedia={[]} />
          </div>
        )}
        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:pb-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-gold px-3.5 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-wide text-gold-ink shadow-[3px_3px_0_var(--ink)]">
              <span className="relative flex h-2 w-2">
                {status.isOpen && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${status.isOpen ? "bg-green" : "bg-ink/40"}`} />
              </span>
              {status.isOpen
                ? `Open now · pickup in ~${wait} min`
                : `Closed · opens ${status.opensAt}${status.opensDay !== "today" ? ` ${status.opensDay}` : ""}`}
            </p>

            <h1 className="font-poster mt-6 break-words text-[3.1rem] uppercase leading-[0.92] sm:text-7xl lg:text-[5.6rem]">
              Your corner store,
              <br />
              <span className="text-gold">now on your phone.</span>
            </h1>
            <p className="mt-5 max-w-xl font-body text-lg text-white/85">
              Snacks, drinks, groceries{alcoholOnSale ? ", wine & beer" : ""} and everyday essentials, a block from the Woodley Park–Zoo
              Metro. Order ahead on the train and grab it on your way to the Zoo — or get it delivered.
            </p>

            {/* Search goes straight to the Order page, filtered. Works without JavaScript. */}
            <form
              action="/order"
              method="get"
              role="search"
              className="mt-7 flex max-w-xl rounded-full border-2 border-ink bg-white p-1.5 shadow-[5px_5px_0_var(--gold)]"
            >
              <label htmlFor="home-search" className="sr-only">
                Search the store
              </label>
              <input
                id="home-search"
                name="q"
                type="search"
                placeholder="What do you need? Chips, milk, coffee…"
                className="min-w-0 flex-1 bg-transparent px-4 font-body text-base text-ink placeholder:text-ink-soft/80 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-full bg-pink-deep px-5 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white transition hover:brightness-110 active:scale-95"
              >
                Search
              </button>
            </form>

            {heroChips.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {heroChips.map((a) => (
                  <Link
                    key={a.name}
                    href={`/order?aisle=${encodeURIComponent(a.name)}`}
                    className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 font-body text-sm font-medium text-white backdrop-blur-sm transition hover:border-gold hover:bg-gold hover:text-gold-ink"
                  >
                    {AISLE_STYLE[a.name]?.short ?? a.name}
                  </Link>
                ))}
                <Link
                  href="/order"
                  className="rounded-full px-3 py-1.5 font-body text-sm font-semibold text-gold underline-offset-4 hover:underline"
                >
                  Browse all →
                </Link>
              </div>
            )}
          </div>

          {/* Photo panel: the store's own photos in rotation, or a product collage. */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative aspect-[5/4] rotate-[1.5deg] lg:aspect-[4/5] overflow-hidden rounded-[2rem] border-4 border-ink bg-gold-tint shadow-[10px_10px_0_var(--gold)]">
              {heroMedia.length > 0 ? (
                <CustomHeroMedia items={heroMedia} />
              ) : collage.length >= 2 ? (
                <div className="grid h-full grid-cols-2 gap-3 p-4">
                  {collage.map((p, i) => (
                    <div key={p.id} className={`flex items-center justify-center rounded-2xl bg-white p-3 ${i % 2 ? "rotate-2" : "-rotate-2"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image_url} alt={p.name} className="max-h-full max-w-full object-contain" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 bg-pink p-8 text-center text-ink">
                  <span className="font-poster text-5xl uppercase sm:text-6xl">Manhattan</span>
                  <span className="font-mono text-sm uppercase tracking-[0.4em]">Market</span>
                </div>
              )}
              {heroMedia.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 z-10 p-5">
                  <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-white drop-shadow">
                    {BUSINESS.streetAddress} · Woodley Park
                  </p>
                </div>
              )}
            </div>
            <span className="absolute -left-3 top-8 z-20 -rotate-6 rounded-xl border-2 border-ink bg-pink px-3 py-2 font-mono text-xs font-bold uppercase text-ink shadow-[3px_3px_0_var(--ink)]">
              Ready in ~{wait} min
            </span>
            <span className="absolute -right-2 bottom-14 z-20 rotate-3 rounded-xl border-2 border-ink bg-white px-3 py-2 font-mono text-xs font-bold uppercase text-ink shadow-[3px_3px_0_var(--ink)]">
              Delivered by Uber
            </span>
          </div>
        </div>
      </section>

      {/* ── Ticker ───────────────────────────────────────────── */}
      <div className="overflow-hidden border-y-2 border-ink bg-gold py-3" aria-hidden>
        <div className="ticker-track flex w-max">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0">
              {ticker.map((t) => (
                <span key={`${copy}-${t}`} className="font-poster flex items-center whitespace-nowrap pl-6 text-xl uppercase text-ink">
                  {t}
                  <span className="pl-6 text-pink-deep">★</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── First-order offer (owner switches it on in Dashboard → Settings) ── */}
      {welcome.enabled && (
        <section className="mx-auto max-w-6xl px-5 pt-10">
          <div className="shadow-sticker flex flex-col items-start gap-4 rounded-[2rem] border-2 border-ink bg-pink p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-ink/70">New here?</p>
              <p className="font-poster mt-1 text-4xl uppercase leading-none text-ink sm:text-5xl">
                ${welcome.amount % 1 === 0 ? welcome.amount.toFixed(0) : welcome.amount.toFixed(2)} off your first order
              </p>
              <p className="mt-2 font-body text-sm text-ink/80">
                {welcome.min > 0 ? `On orders of $${welcome.min.toFixed(0)} or more. ` : ""}Enter the code at checkout — one per customer.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="rounded-xl border-2 border-dashed border-ink bg-white px-5 py-2.5 font-mono text-2xl font-bold tracking-widest text-ink">
                {welcome.code}
              </span>
              <Link
                href="/order"
                className="rounded-full bg-ink px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:bg-green-deep active:scale-95"
              >
                Start shopping →
              </Link>
            </div>
          </div>
        </section>
      )}

      <ReorderCard />

      <MetroZoo wait={wait} alcohol={alcoholOnSale} />

      {/* ── Shop by aisle ───────────────────────────────────── */}
      {aisles.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pb-6 pt-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-poster text-4xl uppercase text-ink sm:text-5xl">Shop by aisle</h2>
            <Link href="/order" className="pb-1 font-mono text-xs font-bold uppercase tracking-wide text-green hover:underline">
              See everything →
            </Link>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {aisles.map((a, i) => {
              const style = AISLE_STYLE[a.name] ?? AISLE_STYLE.Other;
              return (
                <Reveal key={a.name} delayMs={Math.min(i, 7) * 50}>
                  <Link
                    href={`/order?aisle=${encodeURIComponent(a.name)}`}
                    className="shadow-sticker group relative flex h-44 flex-col overflow-hidden rounded-2xl border-2 border-ink p-4 transition-transform hover:-translate-y-1 active:translate-y-0 sm:h-52"
                    style={{ backgroundColor: style.bg, color: style.text }}
                  >
                    <span className="font-poster relative z-10 max-w-[80%] text-2xl uppercase leading-none sm:text-3xl">
                      {style.short}
                    </span>
                    <span className="relative z-10 mt-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide opacity-80">
                      {countLabel(a.count)}
                    </span>
                    <span className="absolute bottom-3 right-3 flex">
                      {a.photos.map((p, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={p.id}
                          src={p.image_url}
                          alt=""
                          className={`h-14 w-14 rounded-xl border-2 border-ink bg-white object-contain p-1 transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20 ${
                            j === 0 ? "-rotate-6" : j === 1 ? "-ml-5 rotate-3" : "-ml-5 -rotate-2"
                          }`}
                        />
                      ))}
                    </span>
                    <span className="absolute bottom-3 left-4 font-mono text-lg font-bold opacity-70 transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Popular right now ───────────────────────────────── */}
      {popular.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-12">
          <h2 className="font-poster text-4xl uppercase text-ink sm:text-5xl">Popular right now</h2>
          <p className="mt-1 font-body text-sm text-ink-soft">What the neighborhood&apos;s grabbing — add straight to your cart.</p>
          <div className="mt-7">
            <PopularRow products={popular} />
          </div>
        </section>
      )}

      {/* ── Today's picks: product of the day + specials ────── */}
      {(productOfDay || specials.length > 0) && (
        <Reveal>
          <section className="mx-auto max-w-6xl px-5 pt-12">
            <div
              className={`shadow-sticker grid overflow-hidden rounded-[2rem] border-2 border-ink bg-pink-tint ${
                productOfDay && specials.length > 0 ? "lg:grid-cols-[1.1fr_0.9fr]" : ""
              }`}
            >
              {productOfDay && (
                <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
                  <div className="relative mx-auto h-44 w-44 shrink-0 -rotate-3 overflow-hidden rounded-2xl border-2 border-ink bg-white sm:mx-0">
                    {productOfDay.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={productOfDay.image_url} alt={productOfDay.name} className="h-full w-full object-contain p-2" />
                    ) : (
                      <ProductPlaceholder
                        name={productOfDay.name}
                        category={productOfDay.category}
                        swatch={productOfDay.swatch}
                        className="h-full w-full"
                      />
                    )}
                  </div>
                  <div>
                    <p className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-pink-deep">
                      Product of the day{productOfDayIsNew ? " · New" : ""}
                    </p>
                    <h3 className="font-poster mt-1 text-3xl uppercase leading-none text-ink sm:text-4xl">{productOfDay.name}</h3>
                    <p className="mt-2 font-body text-sm text-ink-soft">
                      {productOfDay.blurb || "Fresh pick from the shelf — good for you and priced fair."}
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <span className="rounded-lg border-2 border-ink bg-gold px-3 py-1 font-mono text-lg font-bold text-gold-ink">
                        ${productOfDay.price.toFixed(2)}
                      </span>
                      <Link
                        href={`/order#product-${productOfDay.id}`}
                        className="rounded-full bg-green px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:bg-green-deep active:scale-95"
                      >
                        Grab it →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
              {specials.length > 0 && (
                <div className={`bg-gold p-6 sm:p-8 ${productOfDay ? "border-t-2 border-ink lg:border-l-2 lg:border-t-0" : ""}`}>
                  <p className="font-poster text-3xl uppercase text-ink">Today&apos;s specials</p>
                  <ul className="mt-4 flex flex-col gap-2.5">
                    {specials.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/order#product-${p.id}`}
                          className="flex items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2 transition hover:-translate-y-0.5"
                        >
                          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                            {p.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.image_url} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <span className="block h-full w-full" style={{ backgroundColor: p.swatch }} />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-body text-sm font-semibold text-ink">{p.name}</span>
                          <span className="font-mono text-sm font-bold text-ink">${p.price.toFixed(2)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </Reveal>
      )}

      {/* ── How it works ────────────────────────────────────── */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-5 pt-16">
          <h2 className="font-poster text-4xl uppercase text-ink sm:text-5xl">Easy as 1, 2, 3</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              { n: "1", title: "Pick it", body: "Search or browse the aisles — what you see online is what's on our shelves.", color: "bg-green-tint" },
              { n: "2", title: "Pay online", body: "Secure checkout in seconds. No account needed.", color: "bg-gold-tint" },
              {
                n: "3",
                title: "Grab it or get it",
                body: "Ready at the counter in about 15 minutes, or delivered to your door by Uber.",
                color: "bg-pink-tint",
              },
            ].map((s) => (
              <div key={s.n} className={`rounded-2xl border-2 border-ink p-6 ${s.color}`}>
                <span className="font-poster text-6xl leading-none text-green">{s.n}</span>
                <h3 className="font-poster mt-3 text-2xl uppercase text-ink">{s.title}</h3>
                <p className="mt-1.5 font-body text-sm text-ink-soft">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              href="/order"
              className="shadow-sticker rounded-full border-2 border-ink bg-pink-deep px-8 py-4 font-mono text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Start your order
            </Link>
          </div>
        </section>
      </Reveal>

      {/* ── Where we deliver ────────────────────────────────── */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-5 pt-16">
          <div className="rounded-[2rem] border-2 border-ink bg-gold-tint p-6 sm:p-10">
            <DeliveryAreas />
          </div>
        </section>
      </Reveal>

      {/* ── Neighborhood strip ──────────────────────────────── */}
      <Reveal>
        <section className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid overflow-hidden rounded-[2rem] border-2 border-ink bg-green-deep text-white lg:grid-cols-2">
            <div className="p-7 sm:p-10">
              <p className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-gold">Come say hi</p>
              <h2 className="font-poster mt-2 text-4xl uppercase leading-none sm:text-5xl">Woodley Park&apos;s corner market</h2>
              <p className="mt-4 font-body text-white/85">
                {BUSINESS.streetAddress}, Washington, DC 20008 — steps from the Woodley Park–Zoo Metro.
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-2 font-body font-semibold text-white">
                Open every day · 9am – 9pm
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[0.65rem] uppercase ${
                    status.isOpen ? "bg-gold text-gold-ink" : "bg-white/15 text-white"
                  }`}
                >
                  {status.isOpen ? "Open now" : "Closed now"}
                </span>
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={`tel:${BUSINESS.telephone}`}
                  className="rounded-full bg-gold px-5 py-3 font-mono text-xs font-bold uppercase tracking-wide text-gold-ink transition hover:brightness-95 active:scale-95"
                >
                  Call {BUSINESS.telephoneDisplay}
                </a>
                <a
                  href={DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border-2 border-white/60 px-5 py-3 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:border-white active:scale-95"
                >
                  Directions
                </a>
                <a
                  href={BUSINESS.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border-2 border-white/60 px-5 py-3 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:border-white active:scale-95"
                >
                  Instagram
                </a>
              </div>
            </div>
            {gallery.length >= 2 ? (
              <Link href="/gallery" className="grid grid-cols-2 gap-1 bg-ink p-1" aria-label="See the gallery">
                {gallery.slice(0, 4).map((g) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={g.id} src={g.url} alt={g.caption || "Inside Manhattan Market"} className="aspect-square h-full w-full object-cover" />
                ))}
              </Link>
            ) : (
              <iframe
                title="Map to Manhattan Market"
                src="https://www.google.com/maps?q=2647+Connecticut+Ave+NW,+Washington,+DC+20008&output=embed"
                className="h-72 w-full border-0 lg:h-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            )}
          </div>
        </section>
      </Reveal>

      <MobileOrderBar />
    </div>
  );
}
