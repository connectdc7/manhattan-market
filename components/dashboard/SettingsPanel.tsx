"use client";

// Owner-only Settings tab. Currently one setting: the flat service fee
// added to delivery orders on top of Uber's delivery fee. Takes effect on
// the next checkout — orders already placed keep what they paid.
import { useEffect, useState } from "react";
import { getStoreSettings, setDeliveryServiceFee } from "@/lib/settings";
import { inputClass, labelClass } from "./StaffGate";

export default function SettingsPanel() {
  const [saved, setSaved] = useState<number | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getStoreSettings().then((s) => {
      setSaved(s.deliveryServiceFee);
      setValue(s.deliveryServiceFee.toFixed(2));
    });
  }, []);

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
    </div>
  );
}
