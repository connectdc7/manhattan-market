import type { Metadata } from "next";
import Link from "next/link";
import { HOURS_DISPLAY, getStoreStatus, storeTodayName } from "@/lib/store-hours";
import { BUSINESS } from "@/lib/site";
import PageHero from "@/components/PageHero";
import DeliveryAreas from "@/components/DeliveryAreas";

export const metadata: Metadata = {
  title: "Hours & Location — Convenience Store in Woodley Park, Washington DC",
  description:
    "Manhattan Market, 2647 Connecticut Ave NW, Washington, DC 20008 — Woodley Park's corner store by the Woodley Park–Zoo Metro and the National Zoo. Open 9am–9pm every day. Directions, hours, phone and delivery areas.",
  alternates: {
    canonical: "/location",
  },
};

// Open/closed badge and "today" highlight are worked out on each request.
export const dynamic = "force-dynamic";

const MAP_QUERY = encodeURIComponent("Manhattan Market, 2647 Connecticut Ave NW, Washington, DC 20008");

export default function LocationPage() {
  const status = getStoreStatus();
  const today = storeTodayName();

  return (
    <div>
      <PageHero
        eyebrow="Hours & Location"
        title={
          <>
            Your corner store <span className="text-gold">in Woodley Park</span>
          </>
        }
        subtitle={`${BUSINESS.streetAddress}, Washington, DC ${BUSINESS.postalCode} — steps from the Woodley Park–Zoo/Adams Morgan Metro (Red Line).`}
      >
        <span
          className={`inline-flex items-center gap-2 rounded-full border-2 border-ink px-3.5 py-1.5 font-mono text-xs font-bold uppercase ${
            status.isOpen ? "bg-gold text-gold-ink" : "bg-white text-ink"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${status.isOpen ? "bg-green" : "bg-ink/40"}`} />
          {status.isOpen
            ? `Open now · until ${status.closesAt}`
            : `Closed · opens ${status.opensAt}${status.opensDay !== "today" ? ` ${status.opensDay}` : ""}`}
        </span>
      </PageHero>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="overflow-hidden rounded-[2rem] border-2 border-ink bg-panel shadow-[5px_5px_0_var(--ink)]">
            {/* Google Maps embed — the plain "output=embed" form needs no API key. */}
            <iframe
              title="Map showing Manhattan Market at 2647 Connecticut Ave NW, Washington, DC"
              src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`}
              className="block h-72 w-full sm:h-96"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <div className="flex flex-wrap gap-3 border-t-2 border-ink bg-paper p-4">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${MAP_QUERY}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-green px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:bg-green-deep"
              >
                Get directions
              </a>
              <a
                href={`tel:${BUSINESS.telephone}`}
                className="rounded-full border-2 border-ink bg-gold px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-gold-ink transition hover:brightness-95"
              >
                Call {BUSINESS.telephoneDisplay}
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border-2 border-ink bg-paper p-6 shadow-[5px_5px_0_var(--ink)] sm:p-8">
            <h2 className="font-poster text-3xl uppercase text-ink">Store hours</h2>
            <p className="mt-1 font-body text-sm text-ink-soft">Open every day — pickup and delivery during store hours.</p>
            <table className="mt-4 w-full border-collapse font-body text-sm">
              <tbody>
                {HOURS_DISPLAY.map(({ day, time }) => {
                  const isToday = day === today;
                  return (
                    <tr key={day} className={`border-b border-line last:border-none ${isToday ? "bg-gold-tint font-semibold" : ""}`}>
                      <td className="px-2 py-2.5 text-ink">
                        {day}
                        {isToday && <span className="ml-2 font-mono text-[0.6rem] uppercase text-pink-deep">Today</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right font-mono text-ink">{time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-5 flex gap-4 font-body text-sm">
              <a href={BUSINESS.instagram} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-deep hover:underline">
                Instagram
              </a>
              <a href={BUSINESS.facebook} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-deep hover:underline">
                Facebook
              </a>
            </div>
          </div>
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border-2 border-ink bg-green-tint p-6 sm:p-8">
            <h2 className="font-poster text-3xl uppercase text-ink">Getting here</h2>
            <div className="mt-3 space-y-3 font-body text-sm leading-relaxed text-ink-soft">
              <p>
                We&apos;re on Connecticut Avenue NW in Woodley Park, a short walk from the{" "}
                <strong className="text-ink">Woodley Park–Zoo/Adams Morgan Metro</strong> (Red Line) and on the way to the
                National Zoo.
              </p>
              <p>
                Stop in for snacks, cold drinks, groceries and everyday essentials — or order ahead and
                grab it at the counter in about 15 minutes.
              </p>
            </div>
            <Link
              href="/order"
              className="shadow-sticker mt-5 inline-block rounded-full border-2 border-ink bg-pink-deep px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Order for pickup
            </Link>
          </div>
          <div className="rounded-[2rem] border-2 border-ink bg-paper p-6 sm:p-8">
            <DeliveryAreas />
          </div>
        </section>
      </div>
    </div>
  );
}
