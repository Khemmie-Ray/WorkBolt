import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bolt11 from "bolt11";
import type { EscrowWallet, HoldTx } from "./wallet";

const KEY = "e126f68f7eafcc8b74f54d269fe206be715000f94dac067d1c04a8ca3b2db734"; // throwaway signing key
const store = ((
  globalThis as { __wbFake?: Map<string, HoldTx & { createdAt: number }> }
).__wbFake ??= new Map());

export function fakeWallet(): EscrowWallet {
  return {
    async makeHoldInvoice({ amount, payment_hash, description, expiry }) {
      const enc = bolt11.encode({
        network: {
          bech32: "bc",
          pubKeyHash: 0,
          scriptHash: 5,
          validWitnessVersions: [0],
        },
        millisatoshis: String(amount),
        timestamp: Math.floor(Date.now() / 1000),
        tags: [
          { tagName: "payment_hash", data: payment_hash },
          { tagName: "description", data: description },
          { tagName: "expire_time", data: expiry },
          { tagName: "payment_secret", data: randomBytes(32).toString("hex") },
        ],
      });
      const invoice = bolt11.sign(enc, KEY).paymentRequest!;
      const tx = {
        state: "pending" as const,
        invoice,
        amount,
        createdAt: Date.now(),
      };
      store.set(payment_hash, tx);
      return tx;
    },
    async lookupInvoice({ payment_hash }) {
      const tx = store.get(payment_hash);
      if (!tx) throw new Error("Unknown invoice");
      if (tx.state === "pending" && Date.now() - tx.createdAt > 8000)
        tx.state = "accepted";
      return tx;
    },
    async settleHoldInvoice({ preimage }) {
      const hash = createHash("sha256")
        .update(Buffer.from(preimage, "hex"))
        .digest("hex");
      const tx = store.get(hash);
      if (!tx || tx.state !== "accepted") throw new Error("Nothing to settle");
      tx.state = "settled";
      return {};
    },
    async cancelHoldInvoice({ payment_hash }) {
      const tx = store.get(payment_hash);
      if (tx) tx.state = "failed";
      return {};
    },
    async payInvoice() {
      return { preimage: randomBytes(32).toString("hex") };
    },
    close() {},
  };
}
