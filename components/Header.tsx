"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/lib/cart-context";
import { SkylineWordmark } from "@/components/Logo";

const NAV = [
  { href: "/order", label: "Order Online" },
  { href: "/delivery", label: "Delivery" },
  { href: "/gallery", label: "Gallery" },
  { href: "/location", label: "Hours & Location" },
];

export default function Header() {
  const pathname = usePathname();
  const onDashboard = pathname?.startsWith("/dashboard") ?? false;
  // The staff dashboard draws its own top bar (app/dashboard/page.tsx).
  if (onDashboard) return null;
  return <StorefrontHeader />;
}

function StorefrontHeader() {
  const { count, openDrawer } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  // Signed-in staff who hop over to the storefront ("View Storefront")
  // get a button straight back to the dashboard. Customers never sign in,
  // so they never see it.
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    client.auth.getSession().then(({ data }) => setIsStaff(Boolean(data.session)));
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => setIsStaff(Boolean(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="stripe-bar h-1.5" />
      <div className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/" className="skyline-hover-zone flex items-center text-ink" aria-label="Manhattan Market home">
            <SkylineWordmark className="h-11 w-auto shrink-0 sm:h-12" />
          </Link>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative py-1 font-mono text-xs font-bold uppercase tracking-wide transition-colors hover:text-green ${
                    active ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute -bottom-1 left-0 h-1 rounded-full bg-gold transition-all duration-300 ${active ? "w-full" : "w-0"}`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            {isStaff && (
              <Link
                href="/dashboard"
                className="hidden rounded-full bg-green px-4 py-2 font-mono text-xs font-semibold text-white transition-all hover:bg-green-deep active:scale-95 sm:inline-block"
              >
                ← Dashboard
              </Link>
            )}
            {pathname !== "/order" && (
              <Link
                href="/order"
                className="hidden rounded-full border-2 border-ink bg-pink-deep px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-[3px_3px_0_var(--ink)] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none lg:inline-block"
              >
                Order now
              </Link>
            )}
            <button
              onClick={openDrawer}
              className="relative flex items-center rounded-full border-2 border-ink bg-gold px-4 py-2 font-mono text-xs font-bold uppercase text-gold-ink transition-all hover:-translate-y-0.5 active:scale-95"
            >
              Cart
              {count > 0 && (
                <span
                  key={count}
                  className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.7rem] font-bold text-white [animation:bump_0.4s_ease]"
                >
                  {count}
                </span>
              )}
            </button>
            <button
              className="rounded-lg border-2 border-ink p-2 md:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="mt-1 block h-0.5 w-5 bg-ink" />
              <span className="mt-1 block h-0.5 w-5 bg-ink" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t-2 border-ink bg-paper px-5 py-3 md:hidden" aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2.5 font-mono text-sm font-bold uppercase tracking-wide ${
                  pathname === item.href ? "bg-gold text-gold-ink" : "text-ink hover:bg-panel"
                }`}
              >
                {item.label}
              </Link>
            ))}
            {isStaff && (
              <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2.5 font-mono text-sm font-bold uppercase text-green">
                ← Dashboard
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
