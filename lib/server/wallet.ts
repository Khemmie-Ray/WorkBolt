import "server-only";

export interface HoldTx {
  state: "settled" | "pending" | "failed" | "accepted";
  invoice: string;
  amount: number; 
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

export async function withWallet<T>(
  fn: (w: EscrowWallet) => Promise<T>,
): Promise<T> {
  const url = process.env.WORKBOLT_NWC_URL;
  if (!url)
    throw new Error("The commitment bond is switched off on this server.");
  const { NWCClient } = await import("@getalby/sdk/nwc");
  const client = new NWCClient({ nostrWalletConnectUrl: url });
  try {
    return await fn(client as unknown as EscrowWallet);
  } finally {
    client.close();
  }
}
