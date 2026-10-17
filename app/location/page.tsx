import type { Metadata } from "next";
import Link from "next/link";
import { HOURS_DISPLAY } from "@/lib/store-hours";
import { NEIGHBORHOODS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Hours & Location — Woodley Park, Washington DC",
  description:
    "Manhattan Market, 2647 Connecticut Ave NW, Washington, DC 20008 — Woodley Park's corner store by the Woodley Park–Zoo Metro and the National Zoo. Open 9am–9pm every day. Directions, hours and contact info.",
  alternates: {
    canonical: "/location",
  },
};

const MAP_QUERY = encodeURIComponent("Manhattan Market, 2647 Connecticut Ave NW, Washington, DC 20008");

export default function LocationPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="eyebrow text-green">Hours &amp; Location</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Your corner store in Woodley Park
      </h1>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          {/* Google Maps embed — the plain "output=embed" form needs no API key. */}
          <div className="overflow-hidden rounded-lg border border-line bg-panel">
            <iframe
              title="Map showing Manhattan Market at 2647 Connecticut Ave NW, Washington, DC"
              src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`}
              className="block h-64 w-full sm:h-72"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${MAP_QUERY}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-green px-4 py-2 font-mono text-xs font-semibold text-white transition hover:bg-green-deep"
          >
            Get directions →
          </a>
          <p className="mt-4 font-body text-sm text-ink">2647 Connecticut Ave NW</p>
          <p className="font-body text-sm text-ink-soft">Washington, DC 20008</p>
          <p className="mt-2 font-body text-sm text-ink-soft">
            <a href="tel:+12029864774" className="hover:text-pink-deep">(202) 986-4774</a>
          </p>
          <p className="mt-2 flex gap-4 font-body text-sm text-ink-soft">
            <a href="https://www.instagram.com/manhattanmarketdc" target="_blank" rel="noopener noreferrer" className="hover:text-pink-deep">
              Instagram @manhattanmarketdc
            </a>
          </p>
          <p className="font-body text-sm text-ink-soft">
            <a href="https://www.facebook.com/manhattan.market.2025" target="_blank" rel="noopener noreferrer" className="hover:text-pink-deep">
              Facebook · Manhattan Market
            </a>
          </p>
        </div>

        <div>
          <table className="w-full border-collapse font-body text-sm">
            <tbody>
              {HOURS_DISPLAY.map(({ day, time }) => (
                <tr key={day} className="border-b border-line last:border-none">
                  <td className="py-2.5 text-ink">{day}</td>
                  <td className="py-2.5 text-right font-mono text-ink-soft">{time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="mt-12 max-w-2xl font-body text-sm leading-relaxed text-ink-soft">
        <h2 className="font-display text-xl font-bold text-ink">Getting here</h2>
        <p className="mt-2">
          Manhattan Market is on Connecticut Avenue NW in Woodley Park, a short walk from the Woodley
          Park–Zoo/Adams Morgan Metro station (Red Line) and on the way to the National Zoo. Stop in for
          snacks, cold drinks, groceries and everyday essentials — open 9am to 9pm, seven days a week.
        </p>
        <h2 className="mt-6 font-display text-xl font-bold text-ink">Pickup &amp; delivery</h2>
        <p className="mt-2">
          Order online and pick up at the counter, or get it delivered to nearby neighborhoods including{" "}
          {NEIGHBORHOODS.slice(0, -1).join(", ")} and {NEIGHBORHOODS[NEIGHBORHOODS.length - 1]}.{" "}
          <Link href="/order" className="font-semibold text-green-deep underline hover:text-pink-deep">
            Start an order
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
