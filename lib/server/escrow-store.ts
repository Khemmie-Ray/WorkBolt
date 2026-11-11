import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BondStatus } from "@/lib/escrow";

export interface EscrowRecord {
  task_id: string;
  payment_hash: string;
  preimage: string;
  invoice: string;
  bond_sats: number;
  budget_sats: number;
  status: BondStatus;
  work_invoice: string | null;
  work_invoice_at: string | null;
  payout_address: string | null;
  created_at: string;
  closed_at: string | null;
}

let admin: SupabaseClient | null | undefined;
function db(): SupabaseClient | null {
  if (admin === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    admin =
      url && key
        ? createClient(url, key, { auth: { persistSession: false } })
        : null;
  }
  return admin;
}

export const persistent = () => db() !== null;

const memory = ((
  globalThis as { __wbEscrows?: Map<string, EscrowRecord> }
).__wbEscrows ??= new Map());

export async function getEscrow(taskId: string): Promise<EscrowRecord | null> {
  const d = db();
  if (!d) return memory.get(taskId) ?? null;
  const { data, error } = await d
    .from("escrows")
    .select("*")
    .eq("task_id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EscrowRecord | null;
}

export async function saveEscrow(rec: EscrowRecord): Promise<EscrowRecord> {
  const d = db();
  if (!d) {
    memory.set(rec.task_id, rec);
    return rec;
  }
  const { data, error } = await d.from("escrows").upsert(rec).select().single();
  if (error) throw new Error(error.message);
  return data as EscrowRecord;
}

export async function mirrorToTask(
  rec: EscrowRecord,
  extra: Record<string, unknown> = {},
) {
  const d = db();
  if (!d) return; 
  const { error } = await d
    .from("tasks")
    .update({
      bond_sats: rec.bond_sats,
      bond_status: rec.status,
      bond_invoice: rec.invoice,
      ...extra,
    })
    .eq("id", rec.task_id);
  if (error) throw new Error(error.message);
}
