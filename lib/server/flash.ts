import "server-only";

const TEST_URL = "https://api.test.flashapp.me/graphql";
export const flashUrl = () => process.env.FLASH_API_URL || TEST_URL;
export const flashIsTest = () => flashUrl() === TEST_URL;

export const FLASH_INVOICE_SECONDS = 60;

export type FlashStatus = "PAID" | "PENDING" | "EXPIRED";

interface GqlError {
  message: string;
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(flashUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Flash did not respond (${res.status}). Try again.`);
  const json = (await res.json()) as { data?: T; errors?: GqlError[] };
  if (json.errors?.length) throw new Error(friendly(json.errors[0].message));
  if (!json.data) throw new Error("Flash returned no data.");
  return json.data;
}

function friendly(msg: string) {
  if (/not found|no account|CouldNotFind/i.test(msg)) return "No Flash account matches that. Check the username or wallet ID.";
  if (/not a usd|UsdWallet|currency/i.test(msg)) return "That Flash wallet can't receive here. Use the wallet ID of your Flash cash (USD) wallet.";
  return `Flash: ${msg}`;
}

function payloadError(errors: GqlError[] | undefined) {
  if (errors?.length) throw new Error(friendly(errors[0].message));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts a Flash wallet ID as-is, or looks up a username's cash (USD) wallet. */
export async function flashResolveWallet(account: string): Promise<string> {
  const a = account.trim().replace(/^@/, "");
  if (UUID.test(a)) return a.toLowerCase();
  if (!/^[a-zA-Z0-9_]{3,50}$/.test(a)) throw new Error("Enter a Flash username or a wallet ID.");
  const data = await gql<{ accountDefaultWallet: { id: string } }>(
    `query Wallet($username: Username!) {
      accountDefaultWallet(username: $username, walletCurrency: USD) { id }
    }`,
    { username: a },
  );
  return data.accountDefaultWallet.id;
}

/** Flash's own price: how many US cents one sat is worth right now. */
async function centsPerSat(): Promise<number> {
  const data = await gql<{ realtimePrice: { btcSatPrice: { base: number; offset: number } } }>(
    `{ realtimePrice(currency: "USD") { btcSatPrice { base offset } } }`,
  );
  const { base, offset } = data.realtimePrice.btcSatPrice;
  return base / 10 ** offset;
}

/** A 60-second invoice for about `sats`, paid into a Flash cash wallet (converted to dollars by Flash). */
export async function flashCreateInvoice(walletId: string, sats: number, memo: string): Promise<string> {
  const cents = Math.round(sats * (await centsPerSat()) * 100) / 100;
  if (cents < 1) throw new Error("That amount is below one US cent, too small for a Flash cash wallet.");
  const data = await gql<{
    lnUsdInvoiceCreateOnBehalfOfRecipient: { errors: GqlError[]; invoice: { paymentRequest: string } | null };
  }>(
    `mutation Invoice($input: LnUsdInvoiceCreateOnBehalfOfRecipientInput!) {
      lnUsdInvoiceCreateOnBehalfOfRecipient(input: $input) {
        errors { message }
        invoice { paymentRequest }
      }
    }`,
    { input: { recipientWalletId: walletId, amount: cents, memo: memo.slice(0, 100), expiresIn: 1 } },
  );
  const p = data.lnUsdInvoiceCreateOnBehalfOfRecipient;
  payloadError(p.errors);
  if (!p.invoice) throw new Error("Flash did not return an invoice.");
  return p.invoice.paymentRequest;
}

export async function flashInvoiceStatus(paymentRequest: string): Promise<FlashStatus> {
  const data = await gql<{ lnInvoicePaymentStatus: { errors: GqlError[]; status: FlashStatus | null } }>(
    `query Status($input: LnInvoicePaymentStatusInput!) {
      lnInvoicePaymentStatus(input: $input) { errors { message } status }
    }`,
    { input: { paymentRequest } },
  );
  const p = data.lnInvoicePaymentStatus;
  payloadError(p.errors);
  return p.status ?? "PENDING";
}