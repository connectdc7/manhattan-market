"use client";

import { useEffect, useState } from "react";
import { alertSupport, alertsOnHere, AlertSupport, sendTestAlert, turnOffAlerts, turnOnAlerts } from "@/lib/push-client";

// "New order alerts on this device" — on the dashboard's Today page. Each staff
// member turns it on once per phone; it stays on until they turn it off or
// sign out on that phone. See lib/push.ts.
export default function OrderAlerts() {
  const [support, setSupport] = useState<AlertSupport | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const s = alertSupport();
    Promise.resolve(s === "ok" ? alertsOnHere().catch(() => false) : false).then((isOn) => {
      if (cancelled) return;
      setSupport(s);
      setOn(isOn);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (support === null || support === "not-configured" || support === "unsupported") return null;

  const enable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const error = await turnOnAlerts();
      if (error) setMessage(error);
      else {
        setOn(true);
        setMessage("Alerts are on for this device. Try “Send test”.");
      }
    } catch {
      setMessage("Couldn't turn alerts on — try again.");
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    await turnOffAlerts();
    setOn(false);
    setMessage("Alerts are off for this device.");
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    setMessage(await sendTestAlert());
    setBusy(false);
  };

  return (
    <div className="rounded-2xl border-2 border-ink bg-paper px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-tint text-lg">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="font-poster text-xl uppercase leading-none text-ink">New order alerts</p>
          <p className="mt-1 font-body text-sm text-ink-soft">
            {support === "needs-home-screen"
              ? "To get alerts on this iPhone, add the dashboard to your Home Screen first."
              : on
                ? "On for this device — you'll get a notification for every online order."
                : "Get a notification on this device whenever an online order comes in."}
          </p>
        </div>
        {support === "needs-home-screen" ? (
          <button
            type="button"
            onClick={() => setShowHow((v) => !v)}
            className="rounded-full border border-green px-3.5 py-1.5 font-mono text-xs font-semibold text-green hover:bg-green hover:text-white"
          >
            {showHow ? "Hide steps" : "Show me how"}
          </button>
        ) : on ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={test}
              disabled={busy}
              className="rounded-full border border-green px-3.5 py-1.5 font-mono text-xs font-semibold text-green hover:bg-green hover:text-white disabled:opacity-60"
            >
              Send test
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="font-mono text-xs text-ink-soft hover:text-ink disabled:opacity-60"
            >
              Turn off
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white hover:bg-green-deep disabled:opacity-60"
          >
            {busy ? "Turning on…" : "Turn on alerts"}
          </button>
        )}
      </div>
      {showHow && support === "needs-home-screen" && (
        <ol className="mt-3 list-decimal space-y-1 pl-9 font-body text-sm text-ink-soft">
          <li>
            Tap the <span className="font-semibold text-ink">Share</span> button (the square with an arrow) at the bottom of Safari.
          </li>
          <li>
            Scroll down and tap <span className="font-semibold text-ink">Add to Home Screen</span>, then <span className="font-semibold text-ink">Add</span>.
          </li>
          <li>
            Open <span className="font-semibold text-ink">MM Staff</span> from your Home Screen, sign in, and tap{" "}
            <span className="font-semibold text-ink">Turn on alerts</span> → <span className="font-semibold text-ink">Allow</span>.
          </li>
        </ol>
      )}
      {message && <p className="mt-2 font-body text-xs text-ink-soft">{message}</p>}
    </div>
  );
}
