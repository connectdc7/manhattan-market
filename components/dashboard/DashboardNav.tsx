"use client";

import Link from "next/link";
import { useState } from "react";

// The dashboard's menus: a side menu on tablets/computers and a bottom tab
// bar on phones. Regular staff get Today, Orders and Products; owners also
// get the store-running tools (see SECTIONS).

export type Section = "today" | "orders" | "products" | "sales" | "setup" | "homepage" | "gallery" | "staff" | "settings";

type IconName = Section | "more" | "store";

export const SECTIONS: { key: Section; label: string; hint: string; ownerOnly: boolean }[] = [
  { key: "today", label: "Today", hint: "Sales, orders waiting and alerts", ownerOnly: false },
  { key: "orders", label: "Orders", hint: "Online orders — prepare, ready, done", ownerOnly: false },
  { key: "products", label: "Products", hint: "Find an item, fix its stock, hide it online", ownerOnly: false },
  { key: "sales", label: "Sales report", hint: "Trends and best sellers", ownerOnly: true },
  { key: "setup", label: "Store setup", hint: "Clover, categories and product photos", ownerOnly: true },
  { key: "homepage", label: "Homepage", hint: "The website's front-page photos", ownerOnly: true },
  { key: "gallery", label: "Gallery", hint: "Store photos on the Gallery page", ownerOnly: true },
  { key: "staff", label: "Staff", hint: "Who can sign in", ownerOnly: true },
  { key: "settings", label: "Settings", hint: "Payments, fees and offers", ownerOnly: true },
];

export function sectionsFor(isOwner: boolean) {
  return SECTIONS.filter((s) => isOwner || !s.ownerOnly);
}

export function NavIcon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className, "aria-hidden": true };
  switch (name) {
    case "today":
      return (
        <svg {...p}>
          <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "orders":
      return (
        <svg {...p}>
          <path d="M6 7h12l-1 13H7z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </svg>
      );
    case "products":
      return (
        <svg {...p}>
          <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
          <path d="M3 7.5 12 12l9-4.5M12 12v9" />
        </svg>
      );
    case "sales":
      return (
        <svg {...p}>
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
    case "setup":
      return (
        <svg {...p}>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" />
        </svg>
      );
    case "homepage":
      return (
        <svg {...p}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
        </svg>
      );
    case "gallery":
      return (
        <svg {...p}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 16 5-5 4 4 3-3 6 6" />
          <circle cx="16" cy="9" r="1.5" />
        </svg>
      );
    case "staff":
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" />
        </svg>
      );
    case "settings":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
        </svg>
      );
    case "store":
      return (
        <svg {...p}>
          <path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM10 20v-5h4v5" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <circle cx="19" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
  }
}

function Badge({ n, tone = "gold" }: { n: number; tone?: "gold" | "pink" }) {
  if (n <= 0) return null;
  return (
    <span
      className={`min-w-[1.35rem] rounded-full border-2 border-ink px-1.5 text-center font-mono text-[0.65rem] font-bold leading-[1.1rem] ${
        tone === "pink" ? "bg-pink-deep text-white" : "bg-gold text-gold-ink"
      }`}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

// Tablet / computer: the menu down the left side.
export function SideNav({
  current,
  onSelect,
  isOwner,
  activeOrders,
  newOrders,
}: {
  current: Section;
  onSelect: (s: Section) => void;
  isOwner: boolean;
  activeOrders: number;
  newOrders: number;
}) {
  const items = sectionsFor(isOwner);
  const main = items.filter((s) => !s.ownerOnly);
  const owner = items.filter((s) => s.ownerOnly);

  const row = (s: (typeof SECTIONS)[number]) => {
    const active = current === s.key;
    return (
      <button
        key={s.key}
        type="button"
        onClick={() => onSelect(s.key)}
        aria-current={active ? "page" : undefined}
        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left font-body text-[0.95rem] font-semibold transition ${
          active ? "bg-green text-white shadow-[3px_3px_0_var(--ink)]" : "text-ink hover:bg-green-tint"
        }`}
      >
        <NavIcon name={s.key} className={`h-5 w-5 shrink-0 ${active ? "text-gold" : "text-green"}`} />
        <span className="flex-1">{s.label}</span>
        {s.key === "orders" && <Badge n={newOrders > 0 ? newOrders : activeOrders} tone={newOrders > 0 ? "pink" : "gold"} />}
      </button>
    );
  };

  return (
    <nav aria-label="Dashboard" className="flex h-full flex-col gap-1 p-3">
      {main.map(row)}
      {owner.length > 0 && (
        <>
          <p className="mt-5 px-3 pb-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-ink-soft">Owner tools</p>
          {owner.map(row)}
        </>
      )}
      <Link
        href="/"
        target="_blank"
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm font-semibold text-ink-soft transition hover:bg-panel hover:text-ink"
      >
        <NavIcon name="store" className="h-5 w-5 text-ink-soft" />
        View the website ↗
      </Link>
    </nav>
  );
}

// Phone: tabs along the bottom. Owners get a "More" tab for their tools.
export function BottomNav({
  current,
  onSelect,
  isOwner,
  activeOrders,
  newOrders,
}: {
  current: Section;
  onSelect: (s: Section) => void;
  isOwner: boolean;
  activeOrders: number;
  newOrders: number;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const main = SECTIONS.filter((s) => !s.ownerOnly);
  const owner = SECTIONS.filter((s) => s.ownerOnly);
  const onOwnerTab = owner.some((s) => s.key === current);

  const tab = (key: Section | "more", label: string, active: boolean, onClick: () => void, badge?: React.ReactNode) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-1 flex-col items-center gap-1 pb-1 pt-2"
    >
      <span
        className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-gold text-gold-ink" : "text-white/80"}`}
      >
        <NavIcon name={key} className="h-5 w-5" />
      </span>
      <span className={`font-mono text-[0.6rem] font-bold uppercase tracking-wide ${active ? "text-white" : "text-white/70"}`}>{label}</span>
      {badge && <span className="absolute left-1/2 top-0.5 ml-2">{badge}</span>}
    </button>
  );

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <div
            className="absolute inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-2xl border-2 border-ink bg-paper p-2 shadow-sticker"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-3 pb-1 pt-2 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-ink-soft">Owner tools</p>
            {owner.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  onSelect(s.key);
                  setMoreOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${current === s.key ? "bg-green-tint" : "active:bg-panel"}`}
              >
                <NavIcon name={s.key} className="h-5 w-5 text-green" />
                <span className="flex-1">
                  <span className="block font-body text-sm font-semibold text-ink">{s.label}</span>
                  <span className="block font-body text-xs text-ink-soft">{s.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t-2 border-ink bg-green-deep pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {main.map((s) =>
          tab(
            s.key,
            s.label,
            current === s.key && !moreOpen,
            () => {
              setMoreOpen(false);
              onSelect(s.key);
            },
            s.key === "orders" ? <Badge n={newOrders > 0 ? newOrders : activeOrders} tone={newOrders > 0 ? "pink" : "gold"} /> : undefined
          )
        )}
        {isOwner && tab("more", "More", onOwnerTab || moreOpen, () => setMoreOpen((v) => !v))}
      </nav>
    </>
  );
}
