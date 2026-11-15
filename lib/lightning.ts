import { decode } from "light-bolt11-decoder";

export interface DecodedInvoice {
  raw: string;
  sats: number | null;
  paymentHash: string;
  description: string | null;
  createdAt: number;
  expiresAt: number;
  network: "mainnet" | "testnet" | "signet" | "regtest";
}

export function cleanInvoice(input: string): string {
  return input
    .trim()
    .replace(/^lightning:/i, "")
    .toLowerCase();
}

export function decodeInvoice(input: string): DecodedInvoice {
  const raw = cleanInvoice(input);
  if (!/^ln(bc|tb|tbs|bcrt)/.test(raw)) {
    throw new Error(
      "This is not a Lightning invoice. It should start with lnbc.",
    );
  }
  let d;
  try {
    d = decode(raw);
  } catch {
    throw new Error(
      "This invoice could not be read. Copy it again from your wallet.",
    );
  }
  const get = (name: string) =>
    d.sections.find((s: { name: string }) => s.name === name) as
      | { name: string; value: unknown }
      | undefined;

  const msat = get("amount")?.value as string | undefined;
  const timestamp = Number(get("timestamp")?.value ?? 0);
  const expiry = Number(get("expiry")?.value ?? 3600);
  const prefix = raw.match(/^ln(bcrt|tbs|tb|bc)/)?.[1];

  return {
    raw,
    sats: msat ? Math.floor(Number(msat) / 1000) : null,
    paymentHash: String(get("payment_hash")?.value ?? ""),
    description: (get("description")?.value as string) ?? null,
    createdAt: timestamp,
    expiresAt: timestamp + expiry,
    network:
      prefix === "bc"
        ? "mainnet"
        : prefix === "tb"
          ? "testnet"
          : prefix === "tbs"
            ? "signet"
            : "regtest",
  };
}

export function isExpired(inv: DecodedInvoice): boolean {
  return Date.now() / 1000 > inv.expiresAt;
}

export function isLightningAddress(value: string): boolean {
  return /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value.trim());
}

export async function preimageMatches(
  preimageHex: string,
  paymentHash: string,
): Promise<boolean> {
  const hex = preimageHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return false;
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const out = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return out === paymentHash.toLowerCase();
}

export async function invoiceFromAddress(
  address: string,
  sats: number,
  comment?: string,
) {
  const res = await fetch("/api/lnurl", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, sats, comment }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.error ?? "That Lightning address did not return an invoice.",
    );
  return data.invoice as string;
}
