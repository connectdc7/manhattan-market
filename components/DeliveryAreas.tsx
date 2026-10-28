import Link from "next/link";
import { NEIGHBORHOODS } from "@/lib/site";

// "We deliver to Woodley Park, Cleveland Park…" — on the homepage, Order,
// Hours & Location and Delivery pages, so it's clear (to people and to
// search engines) which neighborhoods the store serves.
export default function DeliveryAreas({ tone = "light", compact = false }: { tone?: "light" | "dark"; compact?: boolean }) {
  const dark = tone === "dark";
  return (
    <div>
      {!compact && (
        <>
          <p className={`font-mono text-[0.68rem] font-bold uppercase tracking-widest ${dark ? "text-gold" : "text-pink-deep"}`}>
            Delivered by Uber · pickup in ~15 min
          </p>
          <h2 className={`font-poster mt-1 text-4xl uppercase leading-none sm:text-5xl ${dark ? "text-white" : "text-ink"}`}>
            We deliver to your neighborhood
          </h2>
        </>
      )}
      <ul className={`flex flex-wrap gap-2 ${compact ? "" : "mt-5"}`}>
        {NEIGHBORHOODS.map((n, i) => (
          <li
            key={n}
            className={`rounded-full border-2 px-3.5 py-1.5 font-body text-sm font-semibold ${
              dark
                ? "border-white/30 bg-white/10 text-white"
                : i < 2
                  ? "border-ink bg-gold text-gold-ink"
                  : "border-ink bg-white text-ink"
            }`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="-mt-0.5 mr-1 inline h-3.5 w-3.5 fill-current">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
            </svg>
            {n}
          </li>
        ))}
      </ul>
      {!compact && (
        <p className={`mt-4 font-body text-sm ${dark ? "text-white/80" : "text-ink-soft"}`}>
          Not on the list? Enter your address at checkout — we&apos;ll tell you right away if we can deliver.{" "}
          <Link href="/delivery" className={`font-semibold underline underline-offset-4 ${dark ? "text-gold" : "text-green-deep"}`}>
            Delivery details
          </Link>
        </p>
      )}
    </div>
  );
}
