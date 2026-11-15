import "server-only";
import type { BondStatus } from "@/lib/escrow";
import type { Task } from "@/lib/types";
import { admin, patchTask } from "./supabase-admin";

export interface EscrowRecord {
  task_id: string;
  payment_hash: string;
  preimage: string;
  invoice: string;
  bond_sats: number;
  budget_sats: number;
  status: Exclude<BondStatus, "none">;
  work_invoice: string | null;
  work_invoice_at: string | null;
  payout_address: string | null; // a Lightning address, or "flash:<wallet id>"
  created_at: string;
  closed_at: string | null;
}

export async function getEscrow(taskId: string): Promise<EscrowRecord | null> {
  const { data, error } = await admin()
    .from("escrows")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EscrowRecord | null;
}

export async function saveEscrow(rec: EscrowRecord): Promise<EscrowRecord> {
  const { data, error } = await admin()
    .from("escrows")
    .upsert(rec)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EscrowRecord;
}

/** Copy bond state onto the public task row, so the board and realtime see it. */
export async function mirrorToTask(
  rec: EscrowRecord,
  extra: Partial<Task> = {},
) {
  await patchTask(rec.task_id, {
    bond_sats: rec.bond_sats,
    bond_status: rec.status,
    bond_invoice: rec.invoice,
    ...extra,
  });
}
