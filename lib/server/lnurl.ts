import "server-only";

/**
 * Resolve a Lightning address (LUD-16) into a BOLT11 invoice for an exact amount.
 * Works with Flash, Blink, Wallet of Satoshi, Alby, the nwc.dev test wallets
 * and any LNURL-pay wallet.
 */
export async function invoiceFromAddress(
  address: string,
  sats: number,
  comment?: string,
): Promise<string> {
  const m = /^([a-z0-9._+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(
    String(address).trim(),
  );
  if (!m) throw new Error("That does not look like a Lightning address.");
  if (!Number.isInteger(sats) || sats < 1)
    throw new Error("Amount must be a whole number of sats.");

  const [, user, domain] = m;
  let meta;
  try {
    meta = await getJson(`https://${domain}/.well-known/lnurlp/${user}`);
  } catch {
    throw new Error(
      "Could not reach that wallet. Paste an invoice from your wallet instead.",
    );
  }
  if (meta.status === "ERROR")
    throw new Error(meta.reason ?? "The wallet refused the request.");
  if (meta.tag !== "payRequest")
    throw new Error("That address does not accept payments.");

  const msat = sats * 1000;
  if (msat < meta.minSendable || msat > meta.maxSendable)
    throw new Error(
      `This wallet accepts between ${Math.ceil(meta.minSendable / 1000)} and ${Math.floor(meta.maxSendable / 1000)} sats.`,
    );

  const cb = new URL(meta.callback);
  cb.searchParams.set("amount", String(msat));
  if (comment && meta.commentAllowed)
    cb.searchParams.set("comment", comment.slice(0, meta.commentAllowed));

  const pay = await getJson(cb.toString());
  if (pay.status === "ERROR" || !pay.pr)
    throw new Error(pay.reason ?? "The wallet did not return an invoice.");
  return pay.pr as string;
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}
