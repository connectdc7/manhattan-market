"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { SkylineWordmark } from "@/components/Logo";

const NAV = [
  { href: "/order", label: "Order Online" },
  { href: "/rewards", label: "Rewards" },
  { href: "/gallery", label: "Gallery" },
  { href: "/location", label: "Hours & Location" },
];

export default function Header() {
  const { count, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  // This Header renders on every page, including /dashboard itself — so
  // without this check, a staffer already on the dashboard would still see
  // a "Dashboard ↗" link up top. Clicking it opens ANOTHER dashboard tab
  // (target="_blank" is deliberate everywhere else, so a customer browsing
  // the storefront never loses their place) rather than doing anything
  // useful, and it visually competes with the dashboard's own Orders /
  // Inventory / Rewards / Analytics tabs just below — which are the actual,
  // working way to move between sections. Hiding it here removes that
  // confusing dead end and leaves the real tab bar as the obvious way back.
  const pathname = usePathname();
  const onDashboard = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-40">
      <div className="stripe-bar h-1.5" />
      <div className="border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="skyline-hover-zone flex items-center text-ink">
            <SkylineWordmark className="h-11 w-auto shrink-0 sm:h-12" />
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative py-1 font-body text-sm font-medium text-ink-soft transition-colors hover:text-green"
              >
                {item.label}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-green transition-all duration-300 ease-out group-hover:w-full" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {!onDashboard && (
              <a
                href="/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden rounded-full border border-line bg-paper px-4 py-2 font-mono text-xs font-semibold text-ink-soft transition hover:border-green hover:text-green md:inline-block"
              >
                Dashboard ↗
              </a>
            )}
            <button
              onClick={openDrawer}
              className="relative rounded-full border border-line bg-paper px-4 py-2 font-mono text-xs font-semibold text-ink transition-all hover:border-green hover:text-green active:scale-95"
            >
              Cart
              {count > 0 && (
                <span
                  key={count}
                  className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1 text-[0.7rem] font-bold text-white [animation:bump_0.4s_ease]"
                >
                  {count}
                </span>
              )}
            </button>
            <button
              className="rounded-md border border-line p-2 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="mt-1 block h-0.5 w-5 bg-ink" />
              <span className="mt-1 block h-0.5 w-5 bg-ink" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-line bg-paper px-5 py-3 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-2 font-body text-sm font-medium text-ink-soft hover:bg-panel"
              >
                {item.label}
              </Link>
            ))}
            {!onDashboard && (
              <a
                href="/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-2 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-ink-soft hover:bg-panel"
              >
                Dashboard ↗
              </a>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
