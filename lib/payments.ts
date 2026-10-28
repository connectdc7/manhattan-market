// Which processor online checkout uses right now. The owner chooses in
// Dashboard → Settings → Online payments; Clover is only used once its keys
// are in Vercel, so flipping the switch early can't break checkout.
import { isStripeConfigured } from "./stripe";
import { isCloverCheckoutConfigured } from "./clover-checkout";
import { getStoreSettings } from "./settings";

export type ActiveProvider = "stripe" | "clover" | "none";

export async function activePaymentProvider(): Promise<ActiveProvider> {
  const chosen = (await getStoreSettings()).paymentProvider;
  if (chosen === "clover" && isCloverCheckoutConfigured()) return "clover";
  if (isStripeConfigured()) return "stripe";
  if (isCloverCheckoutConfigured()) return "clover";
  return "none";
}
