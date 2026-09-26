import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply to using the Manhattan Market website and placing an order.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow text-green">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Terms of Service
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wide text-ink-soft">
        Last updated September 2026
      </p>

      <div className="mt-8 space-y-8 font-body text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Using this site</h2>
          <p className="mt-2">
            This website lets you browse Manhattan Market&apos;s menu and place orders for
            pickup or delivery. By using the site, you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Orders &amp; payment</h2>
          <p className="mt-2">
            Prices, availability, and store hours shown on the site reflect what&apos;s in stock
            at our physical store and may change without notice. Payment is processed securely
            through Stripe at checkout. Placing an order is an offer to purchase, which we may
            decline to accept — for example if an item sells out before we can prepare your
            order.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Rewards program</h2>
          <p className="mt-2">
            Rewards points have no cash value, are tied to the phone number or email you sign up
            with, and may be changed or discontinued at any time.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">No warranty</h2>
          <p className="mt-2">
            The site is provided &quot;as is.&quot; We do our best to keep information accurate
            and the site running smoothly, but we don&apos;t guarantee it will be uninterrupted
            or error-free.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Limitation of liability</h2>
          <p className="mt-2">
            To the fullest extent permitted by law, Manhattan Market isn&apos;t liable for
            indirect or incidental damages arising from your use of the site.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Changes to these terms</h2>
          <p className="mt-2">
            We may update these terms from time to time. Continuing to use the site after a
            change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Contact</h2>
          <p className="mt-2">
            Questions about these terms? Reach us at{" "}
            <a href="mailto:partners@manhattanmarketdc.com" className="text-green-deep hover:text-pink-deep">
              partners@manhattanmarketdc.com
            </a>{" "}
            or{" "}
            <a href="tel:+12029864774" className="text-green-deep hover:text-pink-deep">
              (202) 986-4774
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
