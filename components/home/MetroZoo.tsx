import Link from "next/link";

// "Order on the Metro, grab it on the way to (or back from) the Zoo" — the
// store is a block from the Woodley Park–Zoo Metro (Connecticut Ave &
// Woodley Rd) and a few blocks down Connecticut Ave from the National Zoo's
// main entrance (3001 Connecticut Ave NW).
const STOPS = [
  { label: "Woodley Park–Zoo Metro", sub: "Red Line · 1 block away", icon: "metro" },
  { label: "Manhattan Market", sub: "2647 Connecticut Ave NW", icon: "store" },
  { label: "National Zoo", sub: "A few blocks up Connecticut", icon: "zoo" },
] as const;

function Icon({ kind }: { kind: (typeof STOPS)[number]["icon"] }) {
  const common = "h-7 w-7";
  if (kind === "metro")
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="5" y="3" width="14" height="14" rx="3" />
        <path d="M5 11h14M9 21l1.5-4M15 21l-1.5-4" />
        <circle cx="9" cy="14" r="0.8" fill="currentColor" />
        <circle cx="15" cy="14" r="0.8" fill="currentColor" />
      </svg>
    );
  if (kind === "store")
    return (
      <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM4 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3" />
        <path d="M10 20v-5h4v5" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="7" r="2.5" />
      <circle cx="12" cy="14" r="5.5" />
      <circle cx="10" cy="13" r="0.8" fill="currentColor" />
      <circle cx="14" cy="13" r="0.8" fill="currentColor" />
      <path d="M11 16.2c.6.4 1.4.4 2 0" />
    </svg>
  );
}

export default function MetroZoo({ wait, alcohol = false }: { wait: number; alcohol?: boolean }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-14" aria-labelledby="metro-zoo">
      <div className="shadow-sticker overflow-hidden rounded-[2rem] border-2 border-ink bg-green-tint">
        <div className="p-6 sm:p-10">
          <p className="font-mono text-[0.68rem] font-bold uppercase tracking-widest text-pink-deep">
            Taking the Red Line to the Zoo?
          </p>
          <h2 id="metro-zoo" className="font-poster mt-1 text-4xl uppercase leading-none text-ink sm:text-6xl">
            Order on the Metro. <span className="text-green">Grab it on the way.</span>
          </h2>
          <p className="mt-3 max-w-2xl font-body text-base text-ink-soft">
            Manhattan Market is <strong className="text-ink">the</strong> corner store by the Woodley Park–Zoo Metro.
            Order from your phone on the train and it&apos;s bagged and waiting at the counter in about {wait} minutes —
            no hunting for a store, no line.
          </p>

          {/* Route: Metro — store — Zoo */}
          <ol className="relative mt-8 grid gap-6 sm:grid-cols-3 sm:gap-4">
            <span
              aria-hidden
              className="absolute left-8 right-[calc(33.333%-1.75rem)] top-8 hidden border-t-[3px] border-dashed border-ink/40 sm:block"
            />
            {STOPS.map((s, i) => (
              <li key={s.label} className="relative flex items-center gap-3 sm:flex-col sm:items-start">
                <span
                  className={`relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-ink ${
                    i === 1 ? "bg-gold text-gold-ink shadow-[3px_3px_0_var(--ink)]" : "bg-white text-ink"
                  }`}
                >
                  <Icon kind={s.icon} />
                </span>
                <span>
                  <span className="font-poster block text-xl uppercase leading-tight text-ink">{s.label}</span>
                  <span className="block font-body text-sm text-ink-soft">{s.sub}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid border-t-2 border-ink sm:grid-cols-2">
          <div className="p-6 sm:border-r-2 sm:border-ink sm:p-8">
            <p className="font-poster text-2xl uppercase text-ink">Heading to the Zoo</p>
            <p className="mt-1 font-body text-sm text-ink-soft">
              Order as your train pulls in, pick up on your way up Connecticut Ave.
            </p>
            <p className="mt-3 font-body text-sm font-semibold text-ink">
              Cold water · snacks for the kids · juice boxes · sunscreen · wipes
            </p>
          </div>
          <div className="border-t-2 border-ink bg-gold-tint p-6 sm:border-t-0 sm:p-8">
            <p className="font-poster text-2xl uppercase text-ink">Heading home</p>
            <p className="mt-1 font-body text-sm text-ink-soft">
              Order as you leave the Zoo — it&apos;s ready by the time you walk down to the Metro.
            </p>
            <p className="mt-3 font-body text-sm font-semibold text-ink">
              Ice-cold drinks · dinner essentials · milk &amp; eggs{alcohol ? " · wine & beer (21+)" : " · tomorrow's breakfast"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t-2 border-ink bg-paper px-6 py-5 sm:px-10">
          <Link
            href="/order"
            className="shadow-sticker rounded-full border-2 border-ink bg-pink-deep px-6 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            Order ahead now
          </Link>
          <span className="font-body text-sm text-ink-soft">Open every day, 9am–9pm · pay online, skip the line</span>
        </div>
      </div>
    </section>
  );
}
