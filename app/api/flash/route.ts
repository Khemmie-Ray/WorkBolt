import { connection, NextResponse } from "next/server";
import {
  flashCreateInvoice,
  flashInvoiceStatus,
  flashIsTest,
  flashResolveWallet,
} from "@/lib/server/flash";
import { getEscrow, saveEscrow } from "@/lib/server/escrow-store";
import { releaseBond, syncEscrow } from "@/lib/server/escrow-ops";
import {
  HttpError,
  loadTask,
  patchTask,
  requireCaller,
} from "@/lib/server/supabase-admin";

/**
 * GET  -> { network: "test" | "live" }
 * POST { action: "check", account }   -> { wallet }    signed in; proves a Flash account can receive
 * POST { action: "invoice", taskId }  -> { invoice }   poster only; a fresh 60-second invoice
 * POST { action: "confirm", taskId }  -> { status }    anyone; closes the task when Flash says PAID
 */
export async function GET() {
  await connection();
  return NextResponse.json({ network: flashIsTest() ? "test" : "live" });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    switch (body.action) {
      case "check": {
        await requireCaller(req);
        const wallet = await flashResolveWallet(String(body.account ?? ""));
        // Creating an invoice is free, and proves the wallet exists and can receive here.
        await flashCreateInvoice(wallet, 100, "Workbolt wallet check");
        return NextResponse.json({ wallet });
      }

      case "invoice": {
        const task = await flashTask(String(body.taskId ?? ""));
        await requireCaller(
          req,
          task.poster_id,
          "the person who posted this task",
        );
        const memo = `Workbolt: ${task.title}`;
        const rec = await getEscrow(task.id);
        const wallet =
          rec?.status === "locked" && rec.payout_address?.startsWith("flash:")
            ? rec.payout_address.slice(6)
            : await flashResolveWallet(task.flash_wallet ?? "");
        const invoice = await flashCreateInvoice(
          wallet,
          task.budget_sats,
          memo,
        );
        await patchTask(task.id, { invoice });
        // With a bond, escrow checks with Flash that this exact invoice was paid
        if (rec?.status === "locked")
          await saveEscrow({ ...rec, work_invoice: invoice });
        return NextResponse.json({ invoice });
      }

      case "confirm": {
        const task = await flashTask(String(body.taskId ?? ""));
        if (!task.invoice) return NextResponse.json({ status: "PENDING" });
        const status = await flashInvoiceStatus(task.invoice);
        if (status === "PAID") await closePaidTask(task.id, task.invoice);
        return NextResponse.json({ status });
      }

      default:
        return bad("Unknown action.");
    }
  } catch (e) {
    if (e instanceof HttpError) return bad(e.message, e.status);
    return bad((e as Error).message);
  }
}

async function flashTask(id: string) {
  const task = await loadTask(id);
  if (!task) throw new HttpError(404, "This task is not on the board.");
  if (task.invoice_source !== "flash")
    throw new HttpError(400, "This task isn't being paid through Flash.");
  if (task.status !== "in_progress")
    throw new HttpError(409, "This task is already closed.");
  return task;
}

/** Flash says the invoice was paid: close the task, and release the bond if there is one. */
async function closePaidTask(taskId: string, invoice: string) {
  const closed = {
    status: "completed" as const,
    paid_via: "flash" as const,
    completed_at: new Date().toISOString(),
  };
  const rec = await getEscrow(taskId);
  if (rec) {
    const cur = await syncEscrow(rec);
    if (cur.status === "locked" && cur.work_invoice === invoice) {
      await releaseBond(cur, closed);
      return;
    }
  }
  await patchTask(taskId, closed);
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}
