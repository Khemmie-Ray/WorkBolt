"use client";

import { useCallback, useEffect, useState } from "react";
import type { EscrowConfig, EscrowView } from "../escrow";
import { applyEscrow } from "../store";
import type { Task } from "../types";

let configCache: Promise<EscrowConfig> | null = null;

export function getEscrowConfig(): Promise<EscrowConfig> {
  configCache ??= fetch("/api/escrow")
    .then((r) => r.json())
    .catch(() => ({
      enabled: false,
      percent: 0,
      claimAfterMinutes: 60,
      persistent: false,
      fake: false,
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

async function call(
  taskId: string,
  init?: RequestInit,
): Promise<EscrowView | null> {
  const res = await fetch(`/api/escrow/${encodeURIComponent(taskId)}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.error ?? "The escrow service did not respond. Try again.",
    );
  return data.escrow ?? null;
}

export async function escrowAction(
  taskId: string,
  action: "create" | "invoice" | "release" | "claim",
  body: Record<string, unknown> = {},
  extra: Partial<Task> = {},
): Promise<EscrowView | null> {
  const view = await call(taskId, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...body }),
  });
  if (view) applyEscrow(view, extra);
  return view;
}

export function useEscrow(taskId: string, enabled: boolean) {
  const [view, setView] = useState<EscrowView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const v = await call(taskId);
      setView(v);
      setError(null);
      if (v) applyEscrow(v);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [taskId]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || view?.status !== "awaiting") return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [enabled, view?.status, refresh]);

  return { view, setView, error, refresh };
}

export async function payWithConnectedWallet(invoice: string) {
  const bc = await import("@getalby/bitcoin-connect");
  bc.init({ appName: "Workbolt" });
  const provider = await bc.requestProvider();
  provider.sendPayment(invoice).catch(() => {});
}

export async function payAndGetProof(invoice: string): Promise<string> {
  const bc = await import("@getalby/bitcoin-connect");
  bc.init({ appName: "Workbolt" });
  const provider = await bc.requestProvider();
  const { preimage } = await provider.sendPayment(invoice);
  return preimage;
}
