import "server-only";

export interface HoldTx {
  state: "settled" | "pending" | "failed" | "accepted";
  invoice: string;
  amount: number; // msats
}

export interface EscrowWallet {
  makeHoldInvoice(r: {
    amount: number;
    payment_hash: string;
    description: string;
    expiry: number;
  }): Promise<HoldTx>;
  lookupInvoice(r: { payment_hash: string }): Promise<HoldTx>;
  settleHoldInvoice(r: { preimage: string }): Promise<unknown>;
  cancelHoldInvoice(r: { payment_hash: string }): Promise<unknown>;
  payInvoice(r: { invoice: string }): Promise<{ preimage: string }>;
  close(): void;
}

export function walletConfigured() {
  return !!process.env.WORKBOLT_NWC_URL;
}

export function isFakeWallet() {
  return process.env.WORKBOLT_NWC_URL === "fake";
}

export async function withWallet<T>(
  fn: (w: EscrowWallet) => Promise<T>,
): Promise<T> {
  const url = process.env.WORKBOLT_NWC_URL;
  if (!url)
    throw new Error("Escrow wallet is not set up. Add WORKBOLT_NWC_URL.");
  if (url === "fake") {
    const { fakeWallet } = await import("./fake-wallet");
    return fn(fakeWallet());
  }
  const { NWCClient } = await import("@getalby/sdk/nwc");
  const client = new NWCClient({ nostrWalletConnectUrl: url });
  try {
    return await fn(client as unknown as EscrowWallet);
  } finally {
    client.close();
  }
}
