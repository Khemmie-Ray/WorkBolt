import "server-only";
import type { EscrowView } from "@/lib/escrow";
import type { EscrowRecord } from "./escrow-store";

export function claimAfterMinutes(): number {
  const n = Number(process.env.ESCROW_CLAIM_AFTER_MINUTES);
  return Number.isFinite(n) && n >= 0 ? n : 60;
}

export function claimableAt(rec: EscrowRecord): string | null {
  if (!rec.work_invoice_at) return null;
  return new Date(
    new Date(rec.work_invoice_at).getTime() + claimAfterMinutes() * 60_000,
  ).toISOString();
}

export function toView(rec: EscrowRecord): EscrowView {
  return {
    task_id: rec.task_id,
    status: rec.status,
    bond_sats: rec.bond_sats,
    invoice: rec.invoice,
    work_invoice_at: rec.work_invoice_at,
    claimable_at: claimableAt(rec),
    closed_at: rec.closed_at,
  };
}
