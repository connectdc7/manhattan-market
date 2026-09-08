"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";

const NAV = [
  { href: "/order", label: "Order Online" },
  { href: "/rewards", label: "Rewards" },
  { href: "/gallery", label: "Gallery" },
  { href: "/location", label: "Hours & Location" },
];

export default function Header() {
  const { count, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-xl font-bold text-ink">Manhattan Market</span>
          <span className="hidden font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft sm:inline">
            Est. Corner Store
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-body text-sm font-medium text-ink-soft transition hover:text-green"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={openDrawer}
            className="relative rounded-full border border-line bg-paper px-4 py-2 font-mono text-xs font-semibold text-ink transition hover:border-green hover:text-green"
          >
            Cart
            {count > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green px-1 text-[0.7rem] font-bold text-white">
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
        </nav>
      )}
    </header>
  );
}
