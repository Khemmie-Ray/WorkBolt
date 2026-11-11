// File: app/api/escrow/route.ts
import { connection, NextResponse } from "next/server";
import { BOND_PERCENT, type EscrowConfig } from "@/lib/escrow";
import { isFakeWallet, walletConfigured } from "@/lib/server/wallet";
import { persistent } from "@/lib/server/escrow-store";
import { claimAfterMinutes } from "@/lib/server/escrow-rules";

/** Tells the browser whether posting needs a commitment bond. */
export async function GET() {
  await connection(); // read env on each request, not at build time
  const config: EscrowConfig = {
    enabled: walletConfigured(),
    percent: BOND_PERCENT,
    claimAfterMinutes: claimAfterMinutes(),
    persistent: persistent(),
    fake: isFakeWallet(),
  };
  return NextResponse.json(config);
}