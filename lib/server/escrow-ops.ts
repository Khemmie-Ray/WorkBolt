import "server-only";
import { decodeInvoice, isExpired } from "@/lib/lightning";
import type { Task } from "@/lib/types";
import { mirrorToTask, saveEscrow, type EscrowRecord } from "./escrow-store";
import { withWallet } from "./wallet";

const now = () => new Date().toISOString();

/** Ask the wallet where the hold invoice stands and update the record (and the task). */
export async function syncEscrow(rec: EscrowRecord): Promise<EscrowRecord> {
  if (rec.status !== "awaiting" && rec.status !== "locked") return rec;
  const tx = await withWallet((w) =>
    w.lookupInvoice({ payment_hash: rec.payment_hash }),
  );
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
