"use client";

import { useState } from "react";
import type { CloverSale } from "@/lib/clover-stats";
import type { Product } from "@/lib/products";
import type { RewardsSignup } from "@/lib/rewards";

// The drop-down under the dashboard's stat tiles: the list behind each
// number, with every row clickable for its details.

export type TileKey = "sales" | "orders" | "lowstock" | "signups";

const money = (n: number) => `$${n.toFixed(2)}`;
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Row({
  open,
  onToggle,
  children,
  detail,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div className={`border-b border-line last:border-b-0 ${open ? "bg-panel" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-panel"
      >
        {children}
        <span aria-hidden className={`ml-1 text-xs text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && <div className="px-3 pb-3">{detail}</div>}
    </div>
  );
}

function SalesList({ sales, emptyText }: { sales: CloverSale[]; emptyText: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  if (sales.length === 0) return <p className="p-4 font-body text-sm text-ink-soft">{emptyText}</p>;

  return (
    <>
      {sales.slice(0, limit).map((s) => {
        const itemCount = s.items.reduce((n, i) => n + i.qty, 0);
        return (
          <Row
            key={s.id}
            open={openId === s.id}
            onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            detail={
              <div className="rounded-md border border-line bg-paper p-3">
                {s.items.length === 0 ? (
                  <p className="font-body text-sm text-ink-soft">No item details on this sale (e.g. a custom amount).</p>
                ) : (
                  <table className="w-full font-body text-sm">
                    <tbody>
                      {s.items.map((i, idx) => (
                        <tr key={idx} className={i.refunded ? "text-ink-soft line-through" : "text-ink"}>
                          <td className="py-0.5 pr-2">{i.name}</td>
                          <td className="py-0.5 pr-2 text-right font-mono text-xs text-ink-soft">×{i.qty}</td>
                          <td className="py-0.5 text-right font-mono text-xs">{money(i.price * i.qty)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="mt-2 flex justify-between border-t border-line pt-2 font-mono text-xs">
                  <span className="text-ink-soft">Total (incl. tax)</span>
                  <span className="font-semibold text-ink">{money(s.total)}</span>
                </div>
                {s.note && <p className="mt-2 whitespace-pre-line font-body text-xs text-ink-soft">{s.note}</p>}
                <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">
                  {new Date(s.time).toLocaleString()} · Clover order {s.id}
                </p>
              </div>
            }
          >
            <span className="w-16 shrink-0 font-mono text-xs text-ink-soft">{timeOf(s.time)}</span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide ${
                s.source === "online" ? "bg-pink-tint text-pink-deep" : "bg-green-tint text-green-deep"
              }`}
            >
              {s.source === "online" ? "Online" : "In store"}
            </span>
            <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">
              {s.items.length ? s.items.map((i) => i.name).join(", ") : s.title || "Sale"}
            </span>
            <span className="hidden shrink-0 font-mono text-xs text-ink-soft sm:inline">
              {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
            <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold text-ink">{money(s.total)}</span>
          </Row>
        );
      })}
      {sales.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 50)}
          className="w-full py-2.5 font-mono text-xs font-semibold text-green hover:underline"
        >
          Show more ({sales.length - limit} more)
        </button>
      )}
    </>
  );
}

function LowStockList({ products, onOpenInInventory }: { products: Product[]; onOpenInInventory: (name: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);
  if (products.length === 0) return <p className="p-4 font-body text-sm text-ink-soft">Nothing is running low right now.</p>;
  const sorted = [...products].sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));
  return (
    <>
      {sorted.slice(0, limit).map((p) => (
        <Row
          key={p.id}
          open={openId === p.id}
          onToggle={() => setOpenId(openId === p.id ? null : p.id)}
          detail={
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-md border border-line bg-paper p-3 font-body text-sm">
              <span>
                <span className="text-ink-soft">Category:</span> {p.category}
              </span>
              <span>
                <span className="text-ink-soft">Price:</span> {money(p.price)}
              </span>
              <span>
                <span className="text-ink-soft">In stock:</span> {p.stock}
              </span>
              <button
                type="button"
                onClick={() => onOpenInInventory(p.name)}
                className="ml-auto rounded-full border border-green px-3 py-1 font-mono text-xs font-semibold text-green hover:bg-green hover:text-white"
              >
                Open in Inventory
              </button>
            </div>
          }
        >
          <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">{p.name}</span>
          <span className="hidden shrink-0 font-body text-xs text-ink-soft sm:inline">{p.category}</span>
          <span className="w-16 shrink-0 text-right font-mono text-sm font-semibold text-[#a8461a]">{p.stock} left</span>
        </Row>
      ))}
      {sorted.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 50)}
          className="w-full py-2.5 font-mono text-xs font-semibold text-green hover:underline"
        >
          Show more ({sorted.length - limit} more)
        </button>
      )}
    </>
  );
}

function SignupsList({ signups }: { signups: RewardsSignup[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (signups.length === 0) return <p className="p-4 font-body text-sm text-ink-soft">No new rewards signups today.</p>;
  return (
    <>
      {signups.map((s) => (
        <Row
          key={s.id}
          open={openId === s.id}
          onToggle={() => setOpenId(openId === s.id ? null : s.id)}
          detail={
            <div className="rounded-md border border-line bg-paper p-3 font-body text-sm">
              <p className="break-all text-ink">{s.contact}</p>
              <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">
                Signed up {new Date(s.created_at).toLocaleString()}
              </p>
            </div>
          }
        >
          <span className="w-16 shrink-0 font-mono text-xs text-ink-soft">{timeOf(s.created_at)}</span>
          <span className="min-w-0 flex-1 truncate font-body text-sm text-ink">{s.contact}</span>
        </Row>
      ))}
    </>
  );
}

export default function TileDetails({
  which,
  sales,
  salesSource,
  lowStock,
  signupsToday,
  onOpenInInventory,
  onClose,
}: {
  which: TileKey;
  sales: CloverSale[];
  salesSource: string;
  lowStock: Product[];
  signupsToday: RewardsSignup[];
  onOpenInInventory: (name: string) => void;
  onClose: () => void;
}) {
  const title =
    which === "sales" || which === "orders"
      ? `Today's sales · ${sales.length}`
      : which === "lowstock"
        ? `Running low (3 or fewer) · ${lowStock.length}`
        : `Today's rewards signups · ${signupsToday.length}`;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-green/40 bg-paper shadow-sm">
      <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">{title}</p>
        <button type="button" onClick={onClose} className="font-mono text-xs text-ink-soft hover:text-ink" aria-label="Close">
          Close ✕
        </button>
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        {(which === "sales" || which === "orders") && (
          <SalesList sales={sales} emptyText="No sales yet today." />
        )}
        {which === "lowstock" && <LowStockList products={lowStock} onOpenInInventory={onOpenInInventory} />}
        {which === "signups" && <SignupsList signups={signupsToday} />}
      </div>
      {(which === "sales" || which === "orders") && (
        <p className="border-t border-line px-3 py-2 font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">
          {salesSource}
        </p>
      )}
    </div>
  );
}
