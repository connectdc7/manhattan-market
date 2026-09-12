import { HOURS_DISPLAY } from "@/lib/store-hours";

export default function LocationPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="eyebrow text-green">Hours &amp; Location</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Find us
      </h1>
      <p className="mt-2 font-body text-sm text-ink-soft">
        Hours below are a placeholder until confirmed — the address and contact info are current.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <div>
          <div className="flex h-48 items-center justify-center rounded-lg border border-line bg-panel font-mono text-xs uppercase tracking-widest text-ink-soft">
            map placeholder
          </div>
          <p className="mt-4 font-body text-sm text-ink">3706 Connecticut Ave NW</p>
          <p className="font-body text-sm text-ink-soft">Washington, DC 20008</p>
          <p className="mt-2 font-body text-sm text-ink-soft">
            <a href="tel:+12024601405" className="hover:text-pink-deep">(202) 460-1405</a>
          </p>
          <p className="font-body text-sm text-ink-soft">
            <a href="mailto:partners@manhattanmarketdc.com" className="hover:text-pink-deep">
              partners@manhattanmarketdc.com
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
