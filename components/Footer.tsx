import Link from "next/link";
import Reveal from "@/components/Reveal";
import { SkylineWordmark } from "@/components/Logo";
import HideOnDashboard from "@/components/HideOnDashboard";
import { BUSINESS, NEIGHBORHOODS } from "@/lib/site";

// Not shown on the staff dashboard (see HideOnDashboard) — its links all
// lead to the customer storefront.
export default function Footer() {
  return (
    <HideOnDashboard>
      <footer className="mt-auto border-t-2 border-ink bg-green-deep text-white">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Reveal>
                <span className="skyline-hover-zone inline-block">
                  <SkylineWordmark className="h-20 w-auto text-white sm:h-24" />
                </span>
              </Reveal>
              <p className="mt-3 font-body text-sm text-white/75">
                {BUSINESS.streetAddress}
                <br />
                Washington, DC {BUSINESS.postalCode}
              </p>
              <p className="mt-3 font-body text-sm">
                <a href={`tel:${BUSINESS.telephone}`} className="font-semibold text-gold hover:underline">
                  {BUSINESS.telephoneDisplay}
                </a>
              </p>
              <p className="mt-3 flex gap-4 font-body text-sm text-white/80">
                <a href={BUSINESS.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                  Instagram
                </a>
                <a href={BUSINESS.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                  Facebook
                </a>
              </p>
            </div>

            <div>
              <p className="font-poster text-2xl uppercase text-gold">Hours</p>
              <p className="mt-2 font-body text-sm text-white/85">Every day · 9:00am – 9:00pm</p>
              <p className="mt-1 font-body text-sm text-white/60">Pickup &amp; delivery during store hours</p>
            </div>

            <div>
              <p className="font-poster text-2xl uppercase text-gold">We deliver to</p>
              <p className="mt-2 font-body text-sm leading-relaxed text-white/85">{NEIGHBORHOODS.join(" · ")}</p>
              <Link href="/delivery" className="mt-2 inline-block font-body text-sm font-semibold text-gold hover:underline">
                Delivery details →
              </Link>
            </div>

            <div>
              <p className="font-poster text-2xl uppercase text-gold">Shop</p>
              <div className="mt-2 flex flex-col gap-1.5 font-body text-sm text-white/85">
                <Link href="/order" className="hover:text-gold">Order Online</Link>
                <Link href="/delivery" className="hover:text-gold">Delivery</Link>
                <Link href="/gallery" className="hover:text-gold">Gallery</Link>
                <Link href="/location" className="hover:text-gold">Hours &amp; Location</Link>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-5 font-mono text-[0.7rem] uppercase tracking-widest text-white/45">
            <span className="flex gap-4">
              <Link href="/privacy" className="hover:text-gold">Privacy</Link>
              <Link href="/terms" className="hover:text-gold">Terms</Link>
            </span>
            <span>Manhattan Market &copy; {new Date().getFullYear()} · Woodley Park, Washington, DC</span>
          </div>
          {/* Required credit for product photos from Open Food Facts (CC BY-SA) — see lib/photo-lookup.ts. */}
          <p className="mt-3 font-body text-[0.7rem] normal-case tracking-normal text-white/35">
            Some product photos courtesy of{" "}
            <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
              Open Food Facts
            </a>{" "}
            contributors, licensed{" "}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
              CC BY-SA
            </a>
            .
          </p>
        </div>
      </footer>
    </HideOnDashboard>
  );
}
