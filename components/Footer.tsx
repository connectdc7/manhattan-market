import Link from "next/link";
import Reveal from "@/components/Reveal";
import { SkylineWordmark } from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="mt-auto bg-green-deep text-white">
      <div className="stripe-bar h-1.5" />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <Reveal>
              <SkylineWordmark className="h-20 w-auto text-white sm:h-24" />
            </Reveal>
            <p className="mt-3 font-body text-sm text-white/70">
              3706 Connecticut Ave NW
              <br />
              Washington, DC 20008
            </p>
            <p className="mt-3 font-body text-sm text-white/80">
              <a href="tel:+12024601405" className="hover:text-gold">(202) 460-1405</a>
              <br />
              <a href="mailto:partners@manhattanmarketdc.com" className="hover:text-gold">
                partners@manhattanmarketdc.com
              </a>
            </p>
          </div>
          <div>
            <p className="eyebrow text-white/50">Hours</p>
            <p className="mt-2 font-body text-sm text-white/80">
              Mon–Sat · 6:00am – 11:00pm
              <br />
              Sun · 7:00am – 10:00pm
              <br />
              <span className="text-white/50">(placeholder — confirm real hours)</span>
            </p>
          </div>
          <div>
            <p className="eyebrow text-white/50">Site</p>
            <div className="mt-2 flex flex-col gap-1 font-body text-sm text-white/80">
              <Link href="/order" className="hover:text-gold">Order Online</Link>
              <Link href="/rewards" className="hover:text-gold">Rewards</Link>
              <Link href="/gallery" className="hover:text-gold">Gallery</Link>
              <Link href="/location" className="hover:text-gold">Hours &amp; Location</Link>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-5 font-mono text-[0.7rem] uppercase tracking-widest text-white/40">
          <span>Preview build — sample content, not yet final</span>
          <span>Manhattan Market &copy; 2026</span>
        </div>
      </div>
    </footer>
  );
}
