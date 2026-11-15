"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { notifyChanged } from "./store";
import type { Task } from "./types";

export type FlashStatus = "PAID" | "PENDING" | "EXPIRED";

/** Check a Flash username or wallet ID can receive. Returns the wallet ID. */
export async function checkFlashAccount(account: string) {
  return (
    await api<{ wallet: string }>("/api/flash", { action: "check", account })
  ).wallet;
}

/** Poster is ready to pay: the server asks Flash for a fresh 60-second invoice and stores it on the task. */
export async function freshFlashInvoice(taskId: string): Promise<string> {
  const { invoice } = await api<{ invoice: string }>("/api/flash", {
    action: "invoice",
    taskId,
  });
  notifyChanged();
  return invoice;
}

let networkCache: Promise<"test" | "live"> | null = null;
export function useFlashNetwork() {
  const [n, setN] = useState<"test" | "live" | null>(null);
  useEffect(() => {
    networkCache ??= api<{ network: "test" | "live" }>("/api/flash")
      .then((j) => j.network)
      .catch(() => "test" as const);
    networkCache.then(setN);
  }, []);
  return n;
}

/**
 * While a Flash invoice is open, ask the server every few seconds. The server
 * asks Flash; when Flash says PAID, the server closes the task (and releases
 * any bond) itself, and the change arrives through realtime.
 */
export function useFlashWatch(task: Task) {
  // Remember which invoice each answer is about, so an old "expired" never shows on a new invoice
  const [status, setStatus] = useState<{
    invoice: string;
    value: FlashStatus;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active =
    task.invoice_source === "flash" &&
    task.status === "in_progress" &&
    !!task.invoice;

  useEffect(() => {
    if (!active) return;
    let stop = false;
    const invoice = task.invoice!;
    const tick = () =>
      api<{ status: FlashStatus }>("/api/flash", {
        action: "confirm",
        taskId: task.id,
      })
        .then((d) => {
          if (stop) return;
          setStatus({ invoice, value: d.status });
          if (d.status === "PAID") notifyChanged();
          setError(null);
        })
        .catch((e: Error) => !stop && setError(e.message));
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [active, task.id, task.invoice]);

  const current =
    active && status?.invoice === task.invoice ? status.value : null;
  return { active, status: current, error: active ? error : null };
}
