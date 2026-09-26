import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Manhattan Market collects, uses, and protects your information.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="eyebrow text-green">Legal</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 font-mono text-xs uppercase tracking-wide text-ink-soft">
        Last updated September 2026
      </p>

      <div className="mt-8 space-y-8 font-body text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">What we collect</h2>
          <p className="mt-2">
            When you place an order or sign up for Rewards, we ask for a phone number and/or
            email address so we can text or email you when your order is ready and track your
            Rewards points. When you check out, order details (items, quantities, and whether
            you chose pickup or delivery) are saved so we can prepare and fulfill your order.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Payment information</h2>
          <p className="mt-2">
            Payments are processed entirely by Stripe. Manhattan Market never sees or stores
            your card number — Stripe handles that on its own secure, PCI-compliant checkout
            page.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">
            Order-ready text messages
          </h2>
          <p className="mt-2">
            If you provide a phone number at checkout, we use Twilio to send a single text
            letting you know your order is ready for pickup. We don&apos;t use your number for
            marketing texts.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">
            Our in-store inventory system
          </h2>
          <p className="mt-2">
            Our online menu is kept in sync with our in-store point-of-sale system (Clover).
            That connection only reads product, category, and stock information — it never
            reads or shares any customer or order information.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">We don&apos;t sell your data</h2>
          <p className="mt-2">
            We don&apos;t sell, rent, or trade your personal information to third parties. We
            share information only with the service providers named above (Stripe, Twilio, and
            our database host) solely to operate the store and fulfill your orders.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Data retention</h2>
          <p className="mt-2">
            We keep order and Rewards information for as long as needed to run the store and
            our Rewards program. You can ask us to delete your information at any time using
            the contact details below.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Children</h2>
          <p className="mt-2">
            Our site is intended for a general audience and isn&apos;t directed at children
            under 13.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-ink">Questions</h2>
          <p className="mt-2">
            Contact us at{" "}
            <a href="mailto:partners@manhattanmarketdc.com" className="text-green-deep hover:text-pink-deep">
              partners@manhattanmarketdc.com
            </a>
            , by phone at{" "}
            <a href="tel:+12029864774" className="text-green-deep hover:text-pink-deep">
              (202) 986-4774
            </a>
            , or by mail at 3706 Connecticut Ave NW, Washington, DC 20008.
          </p>
        </section>
      </div>
    </div>
  );
}
