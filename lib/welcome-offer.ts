// Checks a first-order welcome code (e.g. WELCOME5 = $5 off over $20).
// Server-only. Rules: the owner has it switched on (Dashboard → Settings),
// the code matches, the items come to at least the minimum, and the phone
// number has never placed an online order before — so each phone gets it
// once, on its first order.
import { supabaseAdmin } from "./supabase-admin";
import { getStoreSettings } from "./settings";

export type WelcomeCheck =
  | { ok: true; code: string; discountCents: number; minCents: number }
  | { ok: false; error: string };

const last10 = (phone: string) => phone.replace(/\D/g, "").slice(-10);

async function phoneHasOrdered(phone: string): Promise<boolean> {
  const admin = supabaseAdmin;
  if (!admin) return true; // can't check → don't hand out discounts
  const key = last10(phone);
  // Match on the last 4 digits in the database, then compare all 10 here
  // (phones are stored however the customer typed them).
  const { data, error } = await admin.from("orders").select("phone").ilike("phone", `%${key.slice(-4)}%`).limit(2000);
  if (error) return true;
  return (data ?? []).some((r) => typeof r.phone === "string" && last10(r.phone) === key);
}

export async function checkWelcomeCode(input: {
  code: string | null | undefined;
  phone: string | null | undefined;
  itemsSubtotalCents: number;
}): Promise<WelcomeCheck> {
  const offer = (await getStoreSettings()).welcomeOffer;
  const code = (input.code ?? "").trim().toUpperCase();
  if (!offer.enabled || !code || code !== offer.code) return { ok: false, error: "That code isn't valid." };
  const minCents = Math.round(offer.min * 100);
  if (input.itemsSubtotalCents < minCents) {
    return { ok: false, error: `${offer.code} works on orders of $${offer.min.toFixed(2)} or more.` };
  }
  const digits = (input.phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, error: "Enter your phone number to use the welcome offer." };
  if (await phoneHasOrdered(digits)) {
    return { ok: false, error: "The welcome offer is for first orders only — this phone number has ordered before." };
  }
  return { ok: true, code: offer.code, discountCents: Math.round(offer.amount * 100), minCents };
}

// For checkouts that can't take a coupon (Clover): take the discount off the
// item prices, splitting single units out as needed so every price stays
// above $0 and the total drops by exactly `discountCents`.
export function discountLines<T extends { name: string; priceCents: number; qty: number }>(lines: T[], discountCents: number): T[] {
  const label = (l: T) => `${l.name} (welcome offer)`;
  // Easiest case: one item costs more than the discount — take it all off one unit.
  const big = [...lines].sort((a, b) => b.priceCents - a.priceCents).find((l) => l.priceCents > discountCents);
  if (big) {
    return lines.flatMap((l) =>
      l === big
        ? [{ ...l, qty: 1, priceCents: l.priceCents - discountCents, name: label(l) }, ...(l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : [])]
        : [l]
    );
  }
  // Otherwise spread it: up to half off each unit, then more if still needed.
  const units = lines.flatMap((l) => Array.from({ length: l.qty }, () => ({ line: l, cut: 0 })));
  let remaining = discountCents;
  for (const share of [0.5, 0.99]) {
    for (const u of units) {
      if (remaining <= 0) break;
      const room = Math.floor(u.line.priceCents * share) - u.cut;
      const take = Math.max(0, Math.min(room, remaining));
      u.cut += take;
      remaining -= take;
    }
  }
  const out: T[] = [];
  for (const l of lines) {
    const mine = units.filter((u) => u.line === l);
    const full = mine.filter((u) => u.cut === 0).length;
    if (full) out.push({ ...l, qty: full });
    for (const u of mine.filter((u) => u.cut > 0)) out.push({ ...l, qty: 1, priceCents: l.priceCents - u.cut, name: label(l) });
  }
  return out;
}
