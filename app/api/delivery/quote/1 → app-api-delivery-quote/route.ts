// Checkout asks this for the Uber delivery fee and ETA once the customer
// enters an address. Public (customers aren't signed in). The fee shown
// here is display-only: /api/checkout/session asks Uber again itself
// before charging, so nobody can tamper with the price from the browser.
import { NextResponse } from "next/server";
import { getDeliveryQuote, isUberConfigured, validateDeliveryAddress, DeliveryAddress } from "@/lib/uber";
import { getStoreSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { deliveryServiceFee } = await getStoreSettings();
  if (!isUberConfigured()) {
    // Not set up yet — checkout keeps taking delivery orders with no Uber fee.
    return NextResponse.json({ configured: false, serviceFee: deliveryServiceFee });
  }

  let body: { address?: Partial<DeliveryAddress>; phone?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const invalid = validateDeliveryAddress(body.address);
  if (invalid) return NextResponse.json({ configured: true, error: invalid }, { status: 400 });

  const result = await getDeliveryQuote(body.address as DeliveryAddress, body.phone ?? null);
  if (!result.ok) {
    return NextResponse.json(
      { configured: true, undeliverable: result.undeliverable, error: result.message },
      { status: result.undeliverable ? 422 : 502 }
    );
  }
  return NextResponse.json({
    configured: true,
    fee: result.quote.fee,
    serviceFee: deliveryServiceFee,
    dropoffEta: result.quote.dropoffEta,
    durationMin: result.quote.durationMin,
  });
}
