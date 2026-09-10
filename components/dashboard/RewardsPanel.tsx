"use client";

import { useMemo, useState } from "react";
import { RewardsSignup } from "@/lib/rewards";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RewardsPanel({ signups }: { signups: RewardsSignup[] }) {
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    if (!search.trim()) return signups;
    const q = search.trim().toLowerCase();
    return signups.filter((s) => s.contact.toLowerCase().includes(q));
  }, [signups, search]);

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by phone or email…"
        className="rounded-full border border-line bg-paper px-4 py-1.5 font-body text-sm text-ink outline-none focus:border-green"
      />

      {shown.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink-soft">
          {signups.length === 0 ? "No signups yet." : "No signups match."}
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-line">
          <table className="w-full border-collapse font-body text-sm">
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-none">
                  <td className="px-4 py-2.5 text-ink">{s.contact}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-ink-soft">{timeAgo(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
