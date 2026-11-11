// File: app/api/escrow/[id]/route.ts
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { bondFor } from "@/lib/escrow";
import {
  decodeInvoice,
  isExpired,
  isLightningAddress,
  preimageMatches,
} from "@/lib/lightning";
import {
  getEscrow,
  mirrorToTask,
  saveEscrow,
  type EscrowRecord,
} from "@/lib/server/escrow-store";
import { claimableAt, toView } from "@/lib/server/escrow-rules";
import { invoiceFromAddress } from "@/lib/server/lnurl";
import { isFakeWallet, withWallet } from "@/lib/server/wallet";

type Ctx = { params: Promise<{ id: string }> };

const now = () => new Date().toISOString();
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

/** Ask the wallet where the hold invoice stands and update the record. */
async function sync(rec: EscrowRecord): Promise<EscrowRecord> {
  if (rec.status !== "awaiting" && rec.status !== "locked") return rec;
  const tx = await withWallet((w) =>
    w.lookupInvoice({ payment_hash: rec.payment_hash }),
  );
  let next: EscrowRecord["status"] = rec.status;
  if (tx.state === "accepted" && rec.status === "awaiting") next = "locked";
  if (tx.state === "failed") next = "expired";
  if (
    tx.state === "pending" &&
    rec.status === "awaiting" &&
    isExpired(decodeInvoice(rec.invoice))
  )
    next = "expired";
  if (next === rec.status) return rec;
  const saved = await saveEscrow({
    ...rec,
    status: next,
    closed_at: next === "expired" ? now() : rec.closed_at,
  });
  await mirrorToTask(saved);
  return saved;
}

// GET: current bond state, refreshed from the wallet
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const rec = await getEscrow(id);
    if (!rec) return NextResponse.json({ escrow: null });
    return NextResponse.json({ escrow: toView(await sync(rec)) });
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}

// POST: { action: "create" | "invoice" | "release" | "claim", ... }
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.action) {
      case "create":
        return await create(id, body);
      case "invoice":
        return await attachInvoice(id, body);
      case "release":
        return await release(id, body);
      case "claim":
        return await claim(id);
      default:
        return fail("Unknown action.");
    }
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}

/** Poster locks the bond: create a hold invoice the server alone can settle. */
async function create(taskId: string, body: Record<string, unknown>) {
  const budget = Number(body.budget_sats);
  if (!Number.isInteger(budget) || budget < 100)
    return fail("The task price is missing or too low.");

  const existing = await getEscrow(taskId);
  if (existing) {
    const cur = await sync(existing);
    if (
      cur.status === "locked" ||
      cur.status === "returned" ||
      cur.status === "claimed"
    )
      return fail("This task's bond is already settled.");
    if (cur.status === "awaiting")
      return NextResponse.json({ escrow: toView(cur) }); // reuse the open invoice
  }

  const preimage = randomBytes(32);
  const payment_hash = createHash("sha256").update(preimage).digest("hex");
  const bond = bondFor(budget);
  const title = String(body.title ?? "Workbolt task").slice(0, 80);

  const tx = await withWallet((w) =>
    w.makeHoldInvoice({
      amount: bond * 1000,
      payment_hash,
      description: `Workbolt commitment: ${title}`,
      expiry: 60 * 60, // an hour to pay it
    }),
  );

  const rec = await saveEscrow({
    task_id: taskId,
    payment_hash,
    preimage: preimage.toString("hex"),
    invoice: tx.invoice,
    bond_sats: bond,
    budget_sats: budget,
    status: "awaiting",
    work_invoice: null,
    work_invoice_at: null,
    payout_address: null,
    created_at: now(),
    closed_at: null,
  });
  await mirrorToTask(rec);
  return NextResponse.json({ escrow: toView(rec) });
}

/** Freelancer's invoice for the full price is recorded here, so release can check proof against it. */
async function attachInvoice(taskId: string, body: Record<string, unknown>) {
  const rec = await getEscrow(taskId);
  if (!rec) return NextResponse.json({ escrow: null }); // no bond on this task
  const cur = await sync(rec);
  if (cur.status !== "locked")
    return NextResponse.json({ escrow: toView(cur) });

  let inv;
  try {
    inv = decodeInvoice(String(body.invoice ?? ""));
  } catch (e) {
    return fail((e as Error).message);
  }
  if (inv.sats !== cur.budget_sats)
    return fail(`The invoice must be for exactly ${cur.budget_sats} sats.`);
  if (isExpired(inv)) return fail("This invoice has expired.");

  const address = body.payout_address ? String(body.payout_address) : null;
  if (address && !isLightningAddress(address))
    return fail("That payout Lightning address is not valid.");

  const saved = await saveEscrow({
    ...cur,
    work_invoice: inv.raw,
    work_invoice_at: now(),
    payout_address: address,
  });
  return NextResponse.json({ escrow: toView(saved) });
}

/** Poster proves the freelancer was paid: cancel the hold, the bond goes back to the poster. */
async function release(taskId: string, body: Record<string, unknown>) {
  const rec = await getEscrow(taskId);
  if (!rec) return fail("This task has no bond.");
  const cur = await sync(rec);
  if (cur.status === "returned")
    return NextResponse.json({ escrow: toView(cur) });
  if (cur.status !== "locked") return fail("The bond is no longer locked.");
  if (!cur.work_invoice)
    return fail("The freelancer has not sent an invoice yet.");

  const preimage = String(body.preimage ?? "")
    .trim()
    .toLowerCase();
  const { paymentHash } = decodeInvoice(cur.work_invoice);
  if (!(await preimageMatches(preimage, paymentHash)))
    return fail(
      "That payment proof does not match the freelancer's invoice. Copy the preimage from your wallet's payment details.",
    );

  await withWallet((w) =>
    w.cancelHoldInvoice({ payment_hash: cur.payment_hash }),
  );
  const saved = await saveEscrow({
    ...cur,
    status: "returned",
    closed_at: now(),
  });
  await mirrorToTask(saved, {
    status: "completed",
    preimage,
    completed_at: now(),
  });
  return NextResponse.json({ escrow: toView(saved) });
}

/** Poster went quiet after delivery: settle the hold and pay the bond to the freelancer. */
async function claim(taskId: string) {
  const rec = await getEscrow(taskId);
  if (!rec) return fail("This task has no bond.");
  const cur = await sync(rec);
  if (cur.status === "claimed")
    return NextResponse.json({ escrow: toView(cur) });
  if (cur.status !== "locked") return fail("The bond is no longer locked.");
  const at = claimableAt(cur);
  if (!at || Date.now() < new Date(at).getTime())
    return fail("The waiting time after your invoice has not passed yet.");
  if (!cur.payout_address)
    return fail(
      "Add a Lightning address to your profile, then send your invoice again.",
    );

  // Settle first (skip if a previous attempt already did), then forward the bond.
  const tx = await withWallet((w) =>
    w.lookupInvoice({ payment_hash: cur.payment_hash }),
  );
  if (tx.state !== "settled")
    await withWallet((w) => w.settleHoldInvoice({ preimage: cur.preimage }));
  if (!isFakeWallet()) {
    const payout = await invoiceFromAddress(
      cur.payout_address,
      cur.bond_sats,
      "Workbolt bond: the poster did not pay",
    );
    await withWallet((w) => w.payInvoice({ invoice: payout }));
  }

  const saved = await saveEscrow({
    ...cur,
    status: "claimed",
    closed_at: now(),
  });
  await mirrorToTask(saved);
  return NextResponse.json({ escrow: toView(saved) });
}
