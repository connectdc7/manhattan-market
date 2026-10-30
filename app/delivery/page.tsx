import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, DELIVERY_ZIPS, NEIGHBORHOODS, SITE_URL } from "@/lib/site";
import { getStoreSettings } from "@/lib/settings";
import { getStorefrontCategories } from "@/lib/categories";
import PageHero from "@/components/PageHero";
import DeliveryAreas from "@/components/DeliveryAreas";

export const metadata: Metadata = {
  title: "Delivery in Woodley Park, Cleveland Park & Nearby DC Neighborhoods",
  description: `Convenience store and grocery delivery from Manhattan Market (2647 Connecticut Ave NW) to ${NEIGHBORHOODS.join(
    ", "
  )} — snacks, drinks, groceries and essentials delivered by Uber, 9am–9pm daily. Or order ahead for pickup in about 15 minutes.`,
  alternates: {
    canonical: "/delivery",
  },
};

// Fees and the wine/beer rule come from the owner's live settings.
export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const [settings, categories] = await Promise.all([getStoreSettings(), getStorefrontCategories()]);
  const alcoholOnSale = categories.some((c) => c.ageRestricted);
  const fee = settings.deliveryServiceFee;
  const alcohol = settings.alcoholDelivery;

  const faqs: { q: string; a: string }[] = [
    {
      q: "Which neighborhoods do you deliver to?",
      a: `We deliver from our store at ${BUSINESS.streetAddress} to ${NEIGHBORHOODS.slice(0, -1).join(", ")} and ${
        NEIGHBORHOODS[NEIGHBORHOODS.length - 1]
      } (ZIP codes ${DELIVERY_ZIPS.join(", ")}) and other nearby addresses. Enter your address at checkout and we'll confirm right away.`,
    },
    {
      q: "How much does delivery cost?",
      a: `The delivery fee comes from Uber and depends on distance — you'll see the exact fee at checkout before you pay${
        fee > 0 ? `, plus a $${fee.toFixed(2)} service fee` : ""
      }.`,
    },
    {
      q: "How long does delivery take?",
      a: "Checkout shows Uber's delivery estimate for your address before you pay. We start packing your order the moment it comes in, and you'll get a tracking link once a courier is on the way.",
    },
    {
      q: "What are your delivery hours?",
      a: "Delivery runs during store hours: 9am to 9pm, every day.",
    },
    ...(alcoholOnSale ? [{
      q: "Can I get wine or beer delivered?",
      a: alcohol
        ? "Yes — wine and beer can be delivered to customers 21+. The courier will check a valid photo ID at the door."
        : "Wine and beer are available for pickup only right now (21+, bring a valid photo ID). Everything else can be delivered.",
    }] : []),
    {
      q: "Can I pick up instead?",
      a: `Yes — choose pickup at checkout and your order is usually ready at the counter in about 15 minutes. We're at ${BUSINESS.streetAddress}, by the Woodley Park–Zoo Metro.`,
    },
  ];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${SITE_URL}/delivery`,
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <PageHero
        eyebrow="Delivery · 9am–9pm daily"
        title={
          <>
            Delivery in Woodley Park, <span className="text-gold">Cleveland Park &amp; nearby</span>
          </>
        }
        subtitle="Snacks, cold drinks, groceries and everyday essentials from your corner store — delivered by Uber, or ready for pickup in about 15 minutes."
      >
        <Link
          href="/order"
          className="inline-block rounded-full border-2 border-ink bg-pink-deep px-6 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white shadow-[4px_4px_0_var(--gold)] transition hover:-translate-y-0.5 active:translate-y-0"
        >
          Start your order
        </Link>
      </PageHero>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <section className="rounded-[2rem] border-2 border-ink bg-paper p-6 shadow-[5px_5px_0_var(--ink)] sm:p-8">
          <DeliveryAreas />
          <p className="mt-4 font-mono text-xs uppercase tracking-wide text-ink-soft">ZIP codes: {DELIVERY_ZIPS.join(" · ")}</p>
        </section>

        <section className="mt-12">
          <h2 className="font-poster text-4xl uppercase text-ink sm:text-5xl">How delivery works</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { n: "1", t: "Fill your cart", b: "Shop what's on our shelves right now — everything online is in stock.", c: "bg-green-tint" },
              { n: "2", t: "Enter your address", b: "We check with Uber and show the delivery fee and estimate before you pay.", c: "bg-gold-tint" },
              { n: "3", t: "We pack, Uber delivers", b: "You get a tracking link as soon as a courier picks up your order.", c: "bg-pink-tint" },
            ].map((s) => (
              <div key={s.n} className={`rounded-2xl border-2 border-ink p-6 ${s.c}`}>
                <span className="font-poster text-6xl leading-none text-green">{s.n}</span>
                <h3 className="font-poster mt-3 text-2xl uppercase text-ink">{s.t}</h3>
                <p className="mt-1.5 font-body text-sm text-ink-soft">{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-poster text-4xl uppercase text-ink sm:text-5xl">Questions</h2>
          <div className="mt-6 divide-y-2 divide-ink overflow-hidden rounded-[2rem] border-2 border-ink bg-paper">
            {faqs.map((f) => (
              <details key={f.q} className="group p-5 sm:p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-body text-base font-semibold text-ink">
                  {f.q}
                  <span className="font-mono text-xl text-pink-deep transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 font-body text-sm leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[2rem] border-2 border-ink bg-green-deep p-7 text-white sm:p-10">
          <p className="font-poster text-4xl uppercase leading-none sm:text-5xl">Hungry? Out of milk? Need batteries?</p>
          <p className="mt-3 font-body text-white/85">Your corner store is open every day, 9am to 9pm.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/order"
              className="rounded-full bg-gold px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-gold-ink transition hover:brightness-95"
            >
              Order now
            </Link>
            <a
              href={`tel:${BUSINESS.telephone}`}
              className="rounded-full border-2 border-white/60 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-white hover:border-white"
            >
              Call {BUSINESS.telephoneDisplay}
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
