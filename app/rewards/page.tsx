"use client";

import { useState, FormEvent } from "react";

export default function RewardsPage() {
  const [submitted, setSubmitted] = useState(false);
  const [contact, setContact] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="eyebrow text-green">Rewards</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Every order gets you closer to a free one
      </h1>
      <p className="mt-3 font-body text-sm text-ink-soft">
        No app, no card to carry — just your phone number or email at checkout. Earn 1
        point per dollar spent; 100 points is a free item.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { step: "1", label: "Sign up", body: "Takes ten seconds, right here." },
          { step: "2", label: "Order like normal", body: "Online or at the register — both count." },
          { step: "3", label: "Redeem", body: "100 points, one free item, no catch." },
        ].map((s) => (
          <div key={s.step} className="rounded-lg border border-line p-4">
            <span className="font-display text-2xl font-bold text-green">{s.step}</span>
            <p className="mt-1 font-body text-sm font-semibold text-ink">{s.label}</p>
            <p className="mt-1 font-body text-xs text-ink-soft">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-line bg-panel p-6">
        {submitted ? (
          <div className="text-center">
            <p className="font-display text-xl font-bold text-green-deep">You&apos;re in!</p>
            <p className="mt-1 font-body text-sm text-ink-soft">
              {contact} is signed up. Your first order starts earning points right away.
            </p>
            <p className="mt-3 font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft">
              Preview build — not yet connected to a real rewards ledger
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email"
              className="flex-1 rounded-full border border-line bg-paper px-4 py-3 font-body text-sm text-ink outline-none focus:border-green"
            />
            <button
              type="submit"
              className="rounded-full bg-gold px-6 py-3 font-mono text-sm font-semibold text-gold-ink transition hover:brightness-95"
            >
              Join Rewards
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
