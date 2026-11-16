"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { notifyChanged } from "./store";
import type { EscrowConfig, EscrowView } from "./escrow";

let configCache: Promise<EscrowConfig> | null = null;

export function getEscrowConfig(): Promise<EscrowConfig> {
  configCache ??= api<EscrowConfig>("/api/escrow").catch(() => ({
    enabled: false,
    percent: 0,
    claimAfterMinutes: 60,
  }));
  return configCache;
}

export function useEscrowConfig(): EscrowConfig | null {
  const [cfg, setCfg] = useState<EscrowConfig | null>(null);
  useEffect(() => {
    getEscrowConfig().then(setCfg);
  }, []);
  return cfg;
}

/** The server checks the caller for every action; bond state then reaches tasks through realtime. */
export async function escrowAction(
  taskId: string,
  action: "create" | "invoice" | "release" | "claim",
  body: Record<string, unknown> = {},
): Promise<EscrowView | null> {
  const data = await api<{ escrow: EscrowView | null }>(
    `/api/escrow/${encodeURIComponent(taskId)}`,
    {
      action,
      ...body,
    },
  );
  notifyChanged();
  return data.escrow;
}

export function useEscrow(taskId: string, enabled: boolean) {
  const [view, setView] = useState<EscrowView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    let next: ReturnType<typeof setTimeout> | null = null;
    api<{ escrow: EscrowView | null }>(
      `/api/escrow/${encodeURIComponent(taskId)}`,
    )
      .then((d) => {
        if (stale) return;
        setView(d.escrow);
        setError(null);
        if (d.escrow?.status === "awaiting")
          next = setTimeout(() => setTick((n) => n + 1), 5000);
      })
      .catch((e: Error) => {
        if (stale) return;
        setError(e.message);
        next = setTimeout(() => setTick((n) => n + 1), 10000);
      });
    return () => {
      stale = true;
      if (next) clearTimeout(next);
    };
  }, [enabled, taskId, tick]);

  return { view, setView, error };
}

export async function payWithConnectedWallet(invoice: string) {
  const bc = await import("@getalby/bitcoin-connect");
  bc.init({ appName: "Workbolt" });
  const provider = await bc.requestProvider();
  provider.sendPayment(invoice).catch(() => {});
}

/** Pay a normal invoice through Bitcoin Connect and return the preimage (proof of payment). */
export async function payAndGetProof(invoice: string): Promise<string> {
  const bc = await import("@getalby/bitcoin-connect");
  bc.init({ appName: "Workbolt" });
  const provider = await bc.requestProvider();
  const { preimage } = await provider.sendPayment(invoice);
  return preimage;
}
