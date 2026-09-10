"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Status = {
  configured: boolean;
  connected: boolean;
  merchantId?: string | null;
  connectedAt?: string | null;
};

type WebhookState = {
  lastVerificationCode: string | null;
  lastEventAt: string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  "not-configured": "Clover isn't configured yet.",
  "missing-code": "Clover didn't send back an authorization code — try connecting again.",
  "state-mismatch": "That connection attempt couldn't be verified — try connecting again.",
  "token-exchange-failed": "Clover rejected the connection request — double-check CLOVER_APP_ID/SECRET.",
  "save-failed": "Clover approved the connection, but saving it failed — try again.",
};

export default function CloverPanel({ onSynced }: { onSynced: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [webhook, setWebhook] = useState<WebhookState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const loadStatus = () => {
    fetch("/api/clover/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false, connected: false }));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    // Reads Clover's one-time redirect params (?clover=connected or
    // ?clover_error=...) to show a result banner, then strips them from
    // the URL so refreshing the page doesn't re-show it. Setting state
    // here (rather than deriving it at render time) is intentional: the
    // banner needs to survive the very replace() call that removes the
    // params it was read from.
    const connected = searchParams.get("clover");
    const error = searchParams.get("clover_error");
    if (connected === "connected") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBanner("Connected to Clover.");
      router.replace("/dashboard");
    } else if (error) {
      setBanner(ERROR_MESSAGES[error] ?? "Something went wrong connecting to Clover.");
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (!status?.connected) return;
    fetch("/api/clover/webhook-code")
      .then((r) => r.json())
      .then(setWebhook)
      .catch(() => {});
  }, [status?.connected]);

  useEffect(() => {
    if (!confirmDisconnect) return;
    const t = setTimeout(() => setConfirmDisconnect(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDisconnect]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/clover/sync", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setSyncResult(`Synced ${body.succeeded} of ${body.total} items.`);
        onSynced();
      } else {
        setSyncResult(body.error || "Sync failed.");
      }
    } catch {
      setSyncResult("Sync failed — check your connection.");
    }
    setSyncing(false);
  };

  const handleDisconnect = async () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    await fetch("/api/clover/disconnect", { method: "POST" });
    setConfirmDisconnect(false);
    loadStatus();
  };

  if (!status) return null;

  return (
    <div className="mb-4 rounded-lg border border-line bg-panel p-4">
      {banner && (
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-wide text-green">{banner}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Clover Sync</p>
          {!status.configured ? (
            <p className="mt-1 font-body text-sm text-ink-soft">
              Not set up yet — add <code className="font-mono text-xs">CLOVER_APP_ID</code> and{" "}
              <code className="font-mono text-xs">CLOVER_APP_SECRET</code> in Vercel to enable. See the
              README&apos;s Clover section.
            </p>
          ) : status.connected ? (
            <p className="mt-1 font-body text-sm text-ink">
              Connected — merchant <span className="font-mono text-xs">{status.merchantId}</span>
              {status.connectedAt && (
                <span className="text-ink-soft"> since {new Date(status.connectedAt).toLocaleDateString()}</span>
              )}
            </p>
          ) : (
            <p className="mt-1 font-body text-sm text-ink-soft">
              Ready to connect — link your Clover account to sync inventory automatically.
            </p>
          )}
        </div>

        {status.configured && (
          <div className="flex items-center gap-3">
            {status.connected ? (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
                >
                  {syncing ? "Syncing…" : "Sync Now"}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-[#a8461a]"
                >
                  {confirmDisconnect ? "Click again to disconnect" : "Disconnect"}
                </button>
              </>
            ) : (
              <a
                href="/api/clover/connect"
                className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep"
              >
                Connect Clover
              </a>
            )}
          </div>
        )}
      </div>

      {syncResult && <p className="mt-2 font-body text-xs text-ink-soft">{syncResult}</p>}

      {status.connected && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft">
            Webhook URL (paste into Clover&apos;s app settings for live updates, not just manual sync)
          </p>
          <p className="mt-1 select-all break-all font-mono text-xs text-ink">
            {typeof window !== "undefined" ? `${window.location.origin}/api/clover/webhook` : ""}
          </p>
          {webhook?.lastVerificationCode && (
            <p className="mt-2 font-body text-xs text-ink-soft">
              Latest verification code from Clover:{" "}
              <span className="select-all font-mono text-ink">{webhook.lastVerificationCode}</span> — paste
              this into Clover&apos;s dashboard to finish verifying the webhook.
            </p>
          )}
          {webhook?.lastEventAt && (
            <p className="mt-1 font-body text-xs text-ink-soft">
              Last webhook event received {new Date(webhook.lastEventAt).toLocaleString()}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
