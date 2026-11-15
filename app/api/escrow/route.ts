import { connection, NextResponse } from "next/server";
import { BOND_PERCENT, type EscrowConfig } from "@/lib/escrow";
import { walletConfigured } from "@/lib/server/wallet";
import { adminConfigured } from "@/lib/server/supabase-admin";
import { claimAfterMinutes } from "@/lib/server/escrow-rules";

/** Tells the browser whether posting needs a commitment bond. */
export async function GET() {
  await connection(); // read env on each request, not at build time
  const config: EscrowConfig = {
    enabled: walletConfigured() && adminConfigured(),
    percent: BOND_PERCENT,
    claimAfterMinutes: claimAfterMinutes(),
  };
  return NextResponse.json(config);
}