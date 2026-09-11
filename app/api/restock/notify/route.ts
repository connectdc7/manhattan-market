import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isEmailConfigured, sendEmail } from "@/lib/notify";

// Called from the dashboard's Inventory tab when staff click "Notify" on a
// restocked item. If RESEND_API_KEY/RESEND_FROM_EMAIL aren't set yet, this
// still marks the requests handled and hands back the raw contact list so
// staff can reach out by hand — it never just silently does nothing.
export async function POST(request: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: "not-configured" }, { status: 501 });
  }

  let body: { productId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  if (!body.productId) {
    return NextResponse.json({ error: "missing-product" }, { status: 400 });
  }

  const [{ data: product }, { data: pending, error: reqError }] = await Promise.all([
    supabase.from("products").select("id, name").eq("id", body.productId).single(),
    supabase
      .from("restock_requests")
      .select("id, contact")
      .eq("product_id", body.productId)
      .eq("notified", false),
  ]);

  if (reqError) {
    return NextResponse.json({ error: reqError.message }, { status: 500 });
  }

  const requests = pending ?? [];
  if (requests.length === 0) {
    return NextResponse.json({ notified: 0, emailed: false, contacts: [] });
  }

  const emailReady = isEmailConfigured();
  if (emailReady) {
    const productName = product?.name ?? "An item you asked about";
    await Promise.allSettled(
      requests.map((r) =>
        sendEmail(
          r.contact,
          `${productName} is back at Manhattan Market`,
          `Good news — ${productName} is back in stock at Manhattan Market. Come get it before it sells out again!`
        )
      )
    );
  }

  const ids = requests.map((r) => r.id);
  await supabase.from("restock_requests").update({ notified: true }).in("id", ids);

  return NextResponse.json({
    notified: requests.length,
    emailed: emailReady,
    contacts: emailReady ? [] : requests.map((r) => r.contact),
  });
}
