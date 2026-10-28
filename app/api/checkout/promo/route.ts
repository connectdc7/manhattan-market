// "Apply" on the checkout page's welcome-code box. Prices come from the
// product list here (never from the browser); the checkout session checks
// the code again before charging. See lib/welcome-offer.ts.
import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/products";
import { checkWelcomeCode } from "@/lib/welcome-offer";

export async function POST(request: Request) {
  let body: { code?: string; phone?: string; items?: { id: string; qty: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const lines = (body.items ?? []).filter((l) => l && typeof l.id === "string" && Number(l.qty) > 0).slice(0, 200);
  const products = await getProductsByIds(lines.map((l) => l.id));
  const itemsSubtotalCents = lines.reduce((sum, l) => {
    const p = products.find((x) => x.id === l.id);
    return sum + (p ? Math.round(p.price * 100) * Math.floor(Number(l.qty)) : 0);
  }, 0);
  const result = await checkWelcomeCode({ code: body.code, phone: body.phone, itemsSubtotalCents });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, code: result.code, discount: result.discountCents / 100, min: result.minCents / 100 });
}
