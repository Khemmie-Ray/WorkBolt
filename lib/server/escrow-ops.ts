// File: lib/server/escrow-ops.ts
import "server-only";
import { decodeInvoice, isExpired } from "@/lib/lightning";
import type { Task } from "@/lib/types";
import { mirrorToTask, saveEscrow, type EscrowRecord } from "./escrow-store";
import { withWallet } from "./wallet";

const now = () => new Date().toISOString();

const LOOKUP_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () =>
        reject(
          new Error(
            "The escrow wallet didn't answer in time. Try again in a minute.",
          ),
        ),
      ms,
    );
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

export async function syncEscrow(
  rec: EscrowRecord,
  opts: { strict?: boolean } = {},
): Promise<EscrowRecord> {
  if (rec.status !== "awaiting" && rec.status !== "locked") return rec;
  let tx;
  try {
    tx = await withTimeout(
      withWallet((w) => w.lookupInvoice({ payment_hash: rec.payment_hash })),
      LOOKUP_TIMEOUT_MS,
    );
  } catch (e) {
    console.error(
      `escrow lookup failed for task ${rec.task_id}:`,
      (e as Error).message,
    );
    if (opts.strict) throw e;
    return rec;
  }
  let next: EscrowRecord["status"] = rec.status;
  if (tx.state === "accepted" && rec.status === "awaiting") next = "locked";
  if (tx.state === "failed") next = "expired";
  if (
    tx.state === "pending" &&
    rec.status === "awaiting" &&
    isExpired(decodeInvoice(rec.invoice))
  )
    next = "expired";
  if (next === rec.status) return rec;
  const saved = await saveEscrow({
    ...rec,
    status: next,
    closed_at: next === "expired" ? now() : rec.closed_at,
  });
  await mirrorToTask(saved);
  return saved;
}

/** Cancel the hold so the bond flows back to the poster, and close the task with `taskPatch`. */
export async function releaseBond(
  rec: EscrowRecord,
  taskPatch: Partial<Task>,
): Promise<EscrowRecord> {
  await withWallet((w) =>
    w.cancelHoldInvoice({ payment_hash: rec.payment_hash }),
  );
  const saved = await saveEscrow({
    ...rec,
    status: "returned",
    closed_at: now(),
  });
  await mirrorToTask(saved, taskPatch);
  return saved;
}
