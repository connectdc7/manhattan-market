"use client";

// Owner-only Settings tab. Currently one setting: the flat service fee
// added to delivery orders on top of Uber's delivery fee. Takes effect on
// the next checkout — orders already placed keep what they paid.
import { useEffect, useState } from "react";
import { getStoreSettings, PaymentProvider, setAlcoholDelivery, setDeliveryServiceFee, setPaymentProvider } from "@/lib/settings";
import { inputClass, labelClass } from "./StaffGate";

export default function SettingsPanel() {
  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [alcoholDelivery, setAlcoholDeliveryState] = useState<boolean | null>(null);
  const [alcoholMsg, setAlcoholMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [provider, setProvider] = useState<PaymentProvider | null>(null);
  const [ready, setReady] = useState<{ stripe: boolean; clover: boolean; active: string } | null>(null);
  const [payMsg, setPayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadPaymentStatus = () =>
    fetch("/api/checkout/status")
      .then((r) => r.json())
      .then((b) => setReady({ stripe: Boolean(b.stripeReady), clover: Boolean(b.cloverCheckoutReady), active: String(b.provider ?? "none") }))
      .catch(() => {});

  useEffect(() => {
    getStoreSettings().then((s) => {
      setSaved(s.deliveryServiceFee);
      setValue(s.deliveryServiceFee.toFixed(2));
      setAlcoholDeliveryState(s.alcoholDelivery);
      setProvider(s.paymentProvider);
    });
    loadPaymentStatus();
  }, []);

  const choosePayments = async (next: PaymentProvider) => {
    if (provider === null || next === provider) return;
    if (
      next === "clover" &&
      !window.confirm(
        "Switch online payments to Clover? New online orders will be paid through Clover's secure payment page. You can switch back to Stripe anytime."
      )
    )
      return;
    setPayMsg(null);
    const err = await setPaymentProvider(next);
    if (err) setPayMsg({ ok: false, text: err });
    else {
      setProvider(next);
      setPayMsg({ ok: true, text: next === "clover" ? "Online payments now go through Clover." : "Online payments now go through Stripe." });
      loadPaymentStatus();
    }
  };

  const toggleAlcoholDelivery = async () => {
    if (alcoholDelivery === null) return;
    const next = !alcoholDelivery;
    if (
      next &&
      !window.confirm(
        "Only turn this on once DC ABCA has confirmed your licence allows delivery, and Uber has enabled alcohol (with ID checks) on your Uber Direct account. Turn on wine & beer delivery?"
      )
    )
      return;
    setAlcoholMsg(null);
    const err = await setAlcoholDelivery(next);
    if (err) setAlcoholMsg({ ok: false, text: err });
    else {
      setAlcoholDeliveryState(next);
      setAlcoholMsg({ ok: true, text: next ? "Wine & beer can now be delivered." : "Wine & beer are pickup only." });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = Number(value);
    setBusy(true);
    setMessage(null);
    const err = await setDeliveryServiceFee(fee);
    setBusy(false);
    if (err) {
      setMessage({ ok: false, text: err });
    } else {
      setSaved(fee);
      setValue(fee.toFixed(2));
      setMessage({
        ok: true,
        text: fee > 0 ? `Saved — delivery orders now include a $${fee.toFixed(2)} service fee.` : "Saved — no service fee on delivery orders.",
      });
    }
  };

  return (
    <div className="max-w-lg">
      <form onSubmit={handleSave} className="rounded-lg border border-line bg-panel p-5">
        <p className={labelClass}>Delivery service fee</p>
        <p className="mt-2 font-body text-sm text-ink-soft">
          A flat amount added to every delivery order, on top of Uber&apos;s delivery fee. Customers see it as its
          own &ldquo;Service fee&rdquo; line at checkout. It helps cover card processing, packing and staff time.
          Set it to $0 to turn it off. Pickup orders never pay it.
        </p>

        <label className="mt-4 flex flex-col gap-1">
          <span className={labelClass}>Amount (USD)</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-ink">$</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={20}
              step="0.25"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={saved === null}
              className={`${inputClass} w-32`}
            />
          </div>
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          {[0, 1, 1.5, 2].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setValue(preset.toFixed(2))}
              className="rounded-full border border-line px-3 py-1 font-mono text-[0.65rem] font-semibold text-ink-soft transition hover:border-green hover:text-green"
            >
              {preset === 0 ? "None" : `$${preset.toFixed(2)}`}
            </button>
          ))}
        </div>

        {message && (
          <p className={`mt-3 font-body text-sm ${message.ok ? "text-green" : "text-[#a8461a]"}`}>{message.text}</p>
        )}

        <button
          type="submit"
          disabled={busy || saved === null}
          className="mt-4 rounded-full bg-green px-4 py-2 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved !== null && (
          <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
            Currently: {saved > 0 ? `$${saved.toFixed(2)} per delivery order` : "no service fee"}
          </p>
        )}
      </form>

      <div className="mt-5 rounded-lg border border-line bg-panel p-5">
        <p className={labelClass}>Wine &amp; beer delivery</p>
        <p className="mt-2 font-body text-sm text-ink-soft">
          Wine and beer (categories marked 21+) can always be ordered for pickup — customers confirm they&apos;re 21+
          and staff check photo ID at the counter. Delivery stays off until DC ABCA confirms your licence allows it and
          Uber turns on alcohol delivery (with ID checks) for your account.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(alcoholDelivery)}
            onClick={toggleAlcoholDelivery}
            disabled={alcoholDelivery === null}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
              alcoholDelivery ? "bg-green" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                alcoholDelivery ? "left-[1.375rem]" : "left-0.5"
              }`}
            />
          </button>
          <span className="font-body text-sm text-ink">
            {alcoholDelivery ? "Delivery allowed for wine & beer" : "Pickup only for wine & beer"}
          </span>
        </div>
        {alcoholMsg && (
          <p className={`mt-3 font-body text-sm ${alcoholMsg.ok ? "text-green" : "text-[#a8461a]"}`}>{alcoholMsg.text}</p>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-line bg-panel p-5">
        <p className={labelClass}>Online payments</p>
        <p className="mt-2 font-body text-sm text-ink-soft">
          Which company processes card payments for website orders. With Clover, the money goes straight into the
          store&apos;s Clover account and orders show as paid on the Clover device.
        </p>
        <div className="mt-4 inline-flex rounded-full border border-line bg-paper p-1">
          {(["stripe", "clover"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => choosePayments(p)}
              disabled={provider === null}
              className={`rounded-full px-4 py-1.5 font-mono text-xs font-semibold transition disabled:opacity-50 ${
                provider === p ? "bg-green text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {p === "stripe" ? "Stripe" : "Clover"}
            </button>
          ))}
        </div>
        {ready && (
          <p className="mt-3 font-body text-xs text-ink-soft">
            Stripe: {ready.stripe ? "connected" : "not set up"} · Clover online payments:{" "}
            {ready.clover ? "connected" : "not set up yet (needs the Clover ecommerce keys in Vercel)"}
            {provider === "clover" && !ready.clover && " — until then customers keep paying through Stripe."}
            {" "}Customers are paying through:{" "}
            <span className="font-semibold text-ink">
              {ready.active === "clover" ? "Clover" : ready.active === "stripe" ? "Stripe" : "nothing (test mode)"}
            </span>
          </p>
        )}
        {payMsg && <p className={`mt-3 font-body text-sm ${payMsg.ok ? "text-green" : "text-[#a8461a]"}`}>{payMsg.text}</p>}
      </div>
    </div>
  );
}
