// File: app/api/escrow/[id]/route.ts
import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { bondFor } from "@/lib/escrow";
import { decodeInvoice, isExpired, preimageMatches } from "@/lib/lightning";
import { getEscrow, mirrorToTask, saveEscrow } from "@/lib/server/escrow-store";
import { releaseBond, syncEscrow } from "@/lib/server/escrow-ops";
import { claimableAt, toView } from "@/lib/server/escrow-rules";
import { invoiceFromAddress } from "@/lib/server/lnurl";
import { flashCreateInvoice, flashResolveWallet } from "@/lib/server/flash";
import {
  admin,
  HttpError,
  loadTask,
  requireCaller,
} from "@/lib/server/supabase-admin";
import { withWallet } from "@/lib/server/wallet";
import type { Profile, Task } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const now = () => new Date().toISOString();
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status });

async function taskOr404(id: string): Promise<Task> {
  const task = await loadTask(id);
  if (!task) throw new HttpError(404, "This task is not on the board.");
  return task;
}

// GET: current bond state, refreshed from the wallet. Anyone may ask.
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const rec = await getEscrow(id);
    if (!rec) return NextResponse.json({ escrow: null });
    return NextResponse.json({ escrow: toView(await syncEscrow(rec)) });
  } catch (e) {
    return fail((e as Error).message, 502);
  }
}

// POST: { action: "create" | "invoice" | "release" | "claim", ... }
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const task = await taskOr404(id);
    switch (body.action) {
      case "create":
        await requireCaller(
          req,
          task.poster_id,
          "the person who posted this task",
        );
        return await create(task);
      case "invoice":
        await requireCaller(
          req,
          task.assignee_id,
          "the person doing this task",
        );
        return await attachInvoice(task, body);
      case "release":
        await requireCaller(
          req,
          task.poster_id,
          "the person who posted this task",
        );
        return await release(task, body);
      case "claim":
        await requireCaller(
          req,
          task.assignee_id,
          "the person doing this task",
        );
        return await claim(task);
      default:
        return fail("Unknown action.");
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status);
    return fail((e as Error).message, 502);
  }
}

/** Poster locks the bond: a hold invoice that only the server can settle. */
async function create(task: Task) {
  if (task.status !== "open") return fail("This task is already under way.");
  const existing = await getEscrow(task.id);
  if (existing) {
    const cur = await syncEscrow(existing);
    if (cur.status === "awaiting")
      return NextResponse.json({ escrow: toView(cur) }); // reuse the open invoice
    if (cur.status !== "expired")
      return fail("This task's commitment is already settled.");
  }

  const preimage = randomBytes(32);
  const payment_hash = createHash("sha256").update(preimage).digest("hex");
  const bond = bondFor(task.budget_sats);

  const tx = await withWallet((w) =>
    w.makeHoldInvoice({
      amount: bond * 1000,
      payment_hash,
      description: `Workbolt commitment: ${task.title}`.slice(0, 100),
      expiry: 60 * 60, // an hour to pay it
    }),
  );

  const rec = await saveEscrow({
    task_id: task.id,
    payment_hash,
    preimage: preimage.toString("hex"),
    invoice: tx.invoice,
    bond_sats: bond,
    budget_sats: task.budget_sats,
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

/**
 * Freelancer asks to be paid. Records where a claimed bond would go (from their own
 * profile), and for Lightning the invoice the poster's payment proof is checked against.
 * Flash invoices are made when the poster pays, so a Flash request has no invoice yet.
 */
async function attachInvoice(task: Task, body: Record<string, unknown>) {
  const rec = await getEscrow(task.id);
  if (!rec) return NextResponse.json({ escrow: null }); // no bond on this task
  const cur = await syncEscrow(rec);
  if (cur.status !== "locked")
    return NextResponse.json({ escrow: toView(cur) });

  const { data: profile } = await admin()
    .from("profiles")
    .select("flash_account, lightning_address")
    .eq("id", task.assignee_id!)
    .single<Pick<Profile, "flash_account" | "lightning_address">>();
  const payout = profile?.flash_account
    ? `flash:${await flashResolveWallet(profile.flash_account)}`
    : (profile?.lightning_address ?? null);

  if (body.flash) {
    if (!profile?.flash_account)
      return fail(
        "Add your Flash username or wallet ID in your profile first.",
      );
    const saved = await saveEscrow({
      ...cur,
      work_invoice: null,
      work_invoice_at: now(),
      payout_address: payout,
    });
    return NextResponse.json({ escrow: toView(saved) });
  }

  let inv;
  try {
    inv = decodeInvoice(String(body.invoice ?? ""));
  } catch (e) {
    return fail((e as Error).message);
  }
  if (inv.sats !== cur.budget_sats)
    return fail(`The invoice must be for exactly ${cur.budget_sats} sats.`);
  if (isExpired(inv)) return fail("This invoice has expired.");

  const saved = await saveEscrow({
    ...cur,
    work_invoice: inv.raw,
    work_invoice_at: now(),
    payout_address: payout,
  });
  return NextResponse.json({ escrow: toView(saved) });
}

/** Poster proves the freelancer was paid (the preimage): the bond goes back to the poster. */
async function release(task: Task, body: Record<string, unknown>) {
  const rec = await getEscrow(task.id);
  if (!rec) return fail("This task has no commitment.");
  const cur = await syncEscrow(rec, { strict: true });
  if (cur.status === "returned")
    return NextResponse.json({ escrow: toView(cur) });
  if (cur.status !== "locked")
    return fail("The commitment is no longer locked.");
  if (!cur.work_invoice)
    return fail("The freelancer has not sent an invoice yet.");

  const preimage = String(body.preimage ?? "")
    .trim()
    .toLowerCase();
  if (
    !(await preimageMatches(
      preimage,
      decodeInvoice(cur.work_invoice).paymentHash,
    ))
  )
    return fail(
      "That payment proof does not match the freelancer's invoice. Copy the preimage from your wallet's payment details.",
    );

  const saved = await releaseBond(cur, {
    status: "completed",
    preimage,
    completed_at: now(),
  });
  return NextResponse.json({ escrow: toView(saved) });
}

/** Poster went quiet after the work was delivered: settle the hold and pay the bond to the freelancer. */
async function claim(task: Task) {
  const rec = await getEscrow(task.id);
  if (!rec) return fail("This task has no commitment.");
  const cur = await syncEscrow(rec, { strict: true });
  if (cur.status === "claimed")
    return NextResponse.json({ escrow: toView(cur) });
  if (cur.status !== "locked")
    return fail("The commitment is no longer locked.");
  const at = claimableAt(cur);
  if (!at || Date.now() < new Date(at).getTime())
    return fail("The waiting time after your request has not passed yet.");
  if (!cur.payout_address)
    return fail(
      "Add your Flash username or a Lightning address to your profile, then ask to be paid again.",
    );

  // Settle first (skip if an earlier attempt already did), then forward the bond.
  const tx = await withWallet((w) =>
    w.lookupInvoice({ payment_hash: cur.payment_hash }),
  );
  if (tx.state !== "settled")
    await withWallet((w) => w.settleHoldInvoice({ preimage: cur.preimage }));
  const memo = "Workbolt commitment: the poster did not pay";
  const payout = cur.payout_address.startsWith("flash:")
    ? await flashCreateInvoice(cur.payout_address.slice(6), cur.bond_sats, memo)
    : await invoiceFromAddress(cur.payout_address, cur.bond_sats, memo);
  await withWallet((w) => w.payInvoice({ invoice: payout }));

  const saved = await saveEscrow({
    ...cur,
    status: "claimed",
    closed_at: now(),
  });
  await mirrorToTask(saved);
  return NextResponse.json({ escrow: toView(saved) });
}
