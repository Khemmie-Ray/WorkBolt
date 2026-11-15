
export const BOND_PERCENT = 20;
export const MIN_BOND_SATS = 21;

export function bondFor(budgetSats: number): number {
  return Math.min(
    budgetSats,
    Math.max(MIN_BOND_SATS, Math.ceil((budgetSats * BOND_PERCENT) / 100)),
  );
}

export type BondStatus =
  | "none" 
  | "awaiting" 
  | "locked" 
  | "returned" 
  | "claimed" 
  | "expired"; 

export interface EscrowView {
  task_id: string;
  status: BondStatus;
  bond_sats: number;
  invoice: string;
  work_invoice_at: string | null;
  claimable_at: string | null; // when the freelancer may claim
  closed_at: string | null;
}

export interface EscrowConfig {
  enabled: boolean;
  percent: number;
  claimAfterMinutes: number;
}

export function isListed(t: { bond_status: BondStatus; status: string }) {
  if (t.status !== "open") return true;
  return t.bond_status === "none" || t.bond_status === "locked";
}
