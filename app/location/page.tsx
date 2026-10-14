import type { Metadata } from "next";
import { HOURS_DISPLAY } from "@/lib/store-hours";

export const metadata: Metadata = {
  title: "Hours & Location",
  description:
    "Visit Manhattan Market at 2647 Connecticut Ave NW, Washington, DC 20008. Store hours, directions, and contact info.",
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
        Find us
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
          <p className="font-body text-sm text-ink-soft">
            <a href="mailto:order@manhattanmarketdc.com" className="hover:text-pink-deep">
              order@manhattanmarketdc.com
            </a>
          </p>
          <p className="mt-2 flex gap-4 font-body text-sm text-ink-soft">
            <a href="https://www.instagram.com/manhattanmarketdc" target="_blank" rel="noopener noreferrer" className="hover:text-pink-deep">
              Instagram @manhattanmarketdc
            </a>
          </p>
          <p className="font-body text-sm text-ink-soft">
            <a href="https://www.facebook.com/manhattanmarketdc" target="_blank" rel="noopener noreferrer" className="hover:text-pink-deep">
              Facebook @manhattanmarketdc
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
    </div>
  );
}
