/**
 * Commitment bond, shared by client and server.
 *
 * When a task is posted, the poster locks part of the price in a Lightning
 * hold invoice. The sats stay in the Lightning network: nobody receives them
 * while the lock is open.
 *  - Poster pays the freelancer and proves it: the lock is cancelled, sats return to the poster.
 *  - Poster goes quiet after the work is delivered: the freelancer claims the bond.
 *  - The lock times out: sats return to the poster automatically.
 */

export const BOND_PERCENT = 20;
export const MIN_BOND_SATS = 21;

export function bondFor(budgetSats: number): number {
  return Math.min(
    budgetSats,
    Math.max(MIN_BOND_SATS, Math.ceil((budgetSats * BOND_PERCENT) / 100)),
  );
}

export type BondStatus =
  | "none" //       escrow switched off when the task was posted
  | "awaiting" //   hold invoice created, not paid yet
  | "locked" //     poster paid, sats held in the network
  | "returned" //   lock cancelled, sats back with the poster
  | "claimed" //    poster went quiet, freelancer was paid the bond
  | "expired"; //   lock timed out or was never paid

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
  persistent: boolean; // false = escrow records live in server memory (local dev only)
  fake: boolean;
}

/** Tasks show on the board only once their bond is locked (or escrow is off). */
export function isListed(t: {
  bond_status?: BondStatus | null;
  status: string;
}) {
  if (t.status !== "open") return true;
  const b = t.bond_status ?? "none";
  return b === "none" || b === "locked";
}
