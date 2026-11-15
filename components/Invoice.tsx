"use client";

import { useEffect, useMemo, useState } from "react";
import { useNow } from "@/lib/hooks";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  Zap,
} from "lucide-react";
import {
  decodeInvoice,
  invoiceFromAddress,
  isExpired,
  preimageMatches,
  type DecodedInvoice,
} from "@/lib/lightning";
import { formatSats, shortAddress } from "@/lib/format";
import { completeTask, requestFlashPayment, sendInvoice } from "@/lib/store";
import { escrowAction, payAndGetProof } from "@/lib/escrow-client";
import { freshFlashInvoice, useFlashWatch } from "@/lib/flash-client";
import type { Profile, Task } from "@/lib/types";

type InvoiceCheck = { ok: boolean; warn?: boolean; text: string };

/** Compare an invoice against the agreed price. */
export function checkInvoice(
  inv: DecodedInvoice,
  agreed: number,
  flash = false,
): InvoiceCheck[] {
  const out: InvoiceCheck[] = [];
  // Flash pays into a dollar wallet, so its invoices land within a few sats of the price
  const close =
    flash &&
    inv.sats !== null &&
    Math.abs(inv.sats - agreed) <= Math.max(2, agreed * 0.03);
  if (inv.sats === null)
    out.push({
      ok: false,
      warn: true,
      text: "This invoice has no amount. The payer will have to type it in.",
    });
  else if (inv.sats === agreed)
    out.push({
      ok: true,
      text: `Amount matches the agreed ${formatSats(agreed)} sats`,
    });
  else if (close)
    out.push({
      ok: true,
      text: `${formatSats(inv.sats)} sats, the agreed price converted to dollars by Flash`,
    });
  else
    out.push({
      ok: false,
      text: `Invoice is for ${formatSats(inv.sats)} sats, but the agreed price is ${formatSats(agreed)}`,
    });
  if (isExpired(inv))
    out.push({
      ok: false,
      text: flash
        ? "This Flash invoice expired. Get a new one."
        : "This invoice has expired. Create a new one in your wallet.",
    });
  if (inv.network !== "mainnet")
    out.push({
      ok: false,
      warn: true,
      text: `This is a ${inv.network} invoice, not real bitcoin`,
    });
  return out;
}

function Checks({ checks }: { checks: InvoiceCheck[] }) {
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li
          key={c.text}
          className={`flex items-start gap-2 text-sm font-semibold ${c.ok ? "text-teal" : c.warn ? "text-gold-deep" : "text-danger"}`}
        >
          {c.ok ? (
            <Check size={16} className="mt-0.5 shrink-0" />
          ) : (
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          )}
          {c.text}
        </li>
      ))}
    </ul>
  );
}

export function useQR(invoice: string | null) {
  // Keyed by invoice, so a new invoice never shows the old code while it renders
  const [qr, setQr] = useState<{ invoice: string; src: string } | null>(null);
  useEffect(() => {
    if (!invoice) return;
    let live = true;
    // Uppercase bech32 fits in a smaller QR code
    QRCode.toDataURL(`lightning:${invoice.toUpperCase()}`, {
      margin: 1,
      width: 480,
      color: { dark: "#24163a", light: "#ffffff" },
    }).then((src) => live && setQr({ invoice, src }));
    return () => {
      live = false;
    };
  }, [invoice]);
  return qr && qr.invoice === invoice ? qr.src : null;
}

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1800);
      }}
    >
      {done ? <Check size={16} /> : <Copy size={16} />}
      {done ? "Copied" : "Copy invoice"}
    </button>
  );
}

// ---------- freelancer: send a payment request ----------

export function InvoiceForm({
  task,
  me,
  replacing,
}: {
  task: Task;
  me: Profile;
  replacing?: boolean;
}) {
  type Mode = "flash" | "address" | "paste";
  const modes: { id: Mode; label: string }[] = [
    ...(me.flash_account
      ? [{ id: "flash" as const, label: "Get paid in Flash" }]
      : []),
    ...(me.lightning_address
      ? [{ id: "address" as const, label: "From my Lightning address" }]
      : []),
    { id: "paste", label: "Paste from my wallet" },
  ];
  const [mode, setMode] = useState<Mode>(modes[0].id);
  const [raw, setRaw] = useState("");
  const [note, setNote] = useState(task.delivery_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decoded = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      return { inv: decodeInvoice(raw), err: null };
    } catch (e) {
      return { inv: null, err: (e as Error).message };
    }
  }, [raw]);

  const checks = decoded?.inv
    ? checkInvoice(decoded.inv, task.budget_sats)
    : [];
  const blocking = checks.some((c) => !c.ok && !c.warn);
  const memo = `Workbolt: ${task.title}`.slice(0, 100);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setRaw(
        await invoiceFromAddress(me.lightning_address!, task.budget_sats, memo),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function pick(m: Mode) {
    setMode(m);
    setRaw("");
    setError(null);
  }

  async function submitFlash() {
    setBusy(true);
    setError(null);
    try {
      if (task.bond_status === "locked") {
        // Escrow records the Flash wallet; it also checks the wallet exists
        await escrowAction(task.id, "invoice", { flash: true });
      }
      await requestFlashPayment(task.id, note.trim());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function submit() {
    if (mode === "flash") return submitFlash();
    if (!decoded?.inv) return setError("Paste or create an invoice first.");
    if (blocking)
      return setError("Fix the invoice problems above before sending.");
    setBusy(true);
    setError(null);
    try {
      if (task.bond_status === "locked") {
        // Record the invoice with escrow first, so the payment proof can be checked against it.
        // The server takes the payout (Flash or Lightning address) from this person's own profile.
        await escrowAction(task.id, "invoice", { invoice: decoded.inv.raw });
      }
      await sendInvoice(task.id, decoded.inv.raw, note.trim());
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold">
          {replacing ? "Send a new invoice" : "Request payment"}
        </h3>
        <p className="mt-1 text-ink-soft">
          When the work is done, share where it is and send a Lightning invoice
          for {formatSats(task.budget_sats)} sats.
        </p>
      </div>

      <label className="field">
        <span>Where is the finished work?</span>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Link to the file, or a note on what you delivered and how"
        />
      </label>

      {modes.length > 1 && (
        <div
          className="inline-flex flex-wrap gap-1 rounded-2xl bg-mist p-1"
          role="tablist"
        >
          {modes.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => pick(m.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${mode === m.id ? "bg-paper shadow-sm" : "text-ink-soft"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      {mode === "flash" && me.flash_account && (
        <div className="rounded-xl bg-mist p-4 text-sm">
          <p>
            {task.poster_name} will pay {formatSats(task.budget_sats)} sats
            straight into your Flash cash wallet (
            <strong>{shortAddress(me.flash_account)}</strong>), where it arrives
            as dollars.
          </p>
          <p className="mt-2 text-ink-soft">
            Flash invoices last 60 seconds, so Workbolt creates one the moment{" "}
            {task.poster_name} is ready to pay. Flash confirms the payment and
            the task closes itself.
          </p>
        </div>
      )}

      {mode === "address" && me.lightning_address && !raw && (
        <div className="rounded-xl bg-mist p-4">
          <p className="text-sm">
            We will ask <strong>{me.lightning_address}</strong> for an invoice
            of exactly {formatSats(task.budget_sats)} sats.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="btn-gold mt-3"
          >
            <Zap size={16} fill="currentColor" />
            {busy ? "Creating…" : "Create invoice"}
          </button>
        </div>
      )}

      {(mode === "paste" || (mode === "address" && raw)) && (
        <label className="field">
          <span>Lightning invoice</span>
          <textarea
            rows={3}
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
            }}
            placeholder="lnbc20u1p…"
            className="font-mono text-sm break-all"
            spellCheck={false}
          />
          <small>
            In Flash or any Lightning wallet, tap Receive, enter{" "}
            {formatSats(task.budget_sats)} sats and copy the invoice.
            {!me.lightning_address &&
              !me.flash_account &&
              " Add a Lightning address or your Flash account in your profile and Workbolt can request it for you."}
          </small>
        </label>
      )}

      {task.bond_status === "locked" &&
        !me.lightning_address &&
        !me.flash_account && (
          <p className="text-sm text-gold-deep">
            Add your Flash username or a Lightning address in your profile
            before sending. Without it you can&apos;t claim {task.poster_name}
            &apos;s commitment if they don&apos;t pay.
          </p>
        )}

      {decoded?.err && (
        <p className="text-sm font-semibold text-danger">{decoded.err}</p>
      )}
      {checks.length > 0 && <Checks checks={checks} />}
      {error && (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy || (mode !== "flash" && (!decoded?.inv || blocking))}
        className="btn-primary"
      >
        {mode === "flash"
          ? `Request payment in Flash`
          : `Send invoice to ${task.poster_name}`}
      </button>
    </div>
  );
}

// ---------- requester: pay and close ----------

export function InvoicePay({ task, canPay }: { task: Task; canPay: boolean }) {
  return task.invoice_source === "flash" ? (
    <FlashPay task={task} canPay={canPay} />
  ) : (
    <LightningPay task={task} canPay={canPay} />
  );
}

function LightningPay({ task, canPay }: { task: Task; canPay: boolean }) {
  const inv = useMemo(() => {
    try {
      return decodeInvoice(task.invoice!);
    } catch {
      return null;
    }
  }, [task.invoice]);
  const qr = useQR(task.invoice);
  const [preimage, setPreimage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!inv)
    return (
      <p className="text-danger">The invoice on this task could not be read.</p>
    );
  const checks = checkInvoice(inv, task.budget_sats);

  const bondLocked = task.bond_status === "locked" && !!task.bond_sats;

  async function close(proof: string | null) {
    setBusy(true);
    setError(null);
    try {
      if (bondLocked && !proof)
        throw new Error(
          "Add the payment proof from your wallet to close the task and get your commitment back.",
        );
      if (proof && !(await preimageMatches(proof, inv!.paymentHash)))
        throw new Error(
          "That payment proof does not match this invoice. Copy the preimage from your wallet's payment details.",
        );
      if (bondLocked) {
        await escrowAction(task.id, "release", { preimage: proof });
      } else {
        await completeTask(task.id, proof);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function connected() {
    setBusy(true);
    setError(null);
    try {
      const pre = await payAndGetProof(inv!.raw);
      await close(pre);
    } catch (e) {
      setError((e as Error).message || "The payment did not go through.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold">
          {canPay ? `Pay ${task.assignee_name}` : "Invoice sent"}
        </h3>
        <p className="mt-1 text-ink-soft">
          {canPay
            ? "Scan with Flash or any Lightning wallet. When the payment goes through, mark the task paid."
            : `Waiting for ${task.poster_name} to pay this invoice.`}
        </p>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="Lightning invoice QR code"
            className="w-full max-w-[220px] rounded-xl border border-line bg-white p-2"
          />
        )}
        <div className="min-w-0 flex-1 space-y-4">
          <Checks checks={checks} />
          <p className="break-all font-mono text-xs text-ink-soft">
            {shortAddress(inv.raw)}
          </p>
          <div className="flex flex-wrap gap-2">
            <CopyButton value={inv.raw} />
            {canPay && (
              <button
                type="button"
                onClick={connected}
                disabled={busy}
                className="btn-gold"
              >
                <Wallet size={16} />
                Pay with a connected wallet
              </button>
            )}
            {canPay && (
              <a href={`lightning:${inv.raw}`} className="btn-ghost">
                <ExternalLink size={16} />
                Open in wallet
              </a>
            )}
          </div>
        </div>
      </div>

      {canPay && (
        <div className="space-y-3 border-t border-line pt-5">
          <label className="field">
            <span>
              {bondLocked ? "Payment proof" : "Payment proof (optional)"}
            </span>
            <input
              value={preimage}
              onChange={(e) => setPreimage(e.target.value)}
              placeholder="Preimage from your wallet's payment details"
              className="font-mono text-sm"
              spellCheck={false}
            />
            <small>
              {bondLocked
                ? `Most wallets show a 64-character preimage in the payment details. It proves you paid, and releases your ${formatSats(task.bond_sats!)}-sat commitment back to you.`
                : "Most wallets show a 64-character preimage after paying. Adding it lets anyone confirm this exact invoice was paid."}
            </small>
          </label>
          {error && (
            <p className="text-sm font-semibold text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => close(preimage.trim() || null)}
            disabled={busy}
            className="btn-primary"
          >
            <ShieldCheck size={16} />
            {busy
              ? "Saving…"
              : bondLocked
                ? "Prove payment and close task"
                : "I've paid, mark task completed"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Flash: invoice made at pay time (Flash invoices last 60 seconds) ----------

function FlashPay({ task, canPay }: { task: Task; canPay: boolean }) {
  const flash = useFlashWatch(task);
  const qr = useQR(task.invoice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nowMs = useNow();

  const inv = useMemo(() => {
    try {
      return task.invoice ? decodeInvoice(task.invoice) : null;
    } catch {
      return null;
    }
  }, [task.invoice]);

  const secondsLeft = inv
    ? Math.max(0, Math.round(inv.expiresAt - nowMs / 1000))
    : 0;
  const paid = flash.status === "PAID";
  const live =
    !!inv && !!nowMs && !paid && secondsLeft > 0 && flash.status !== "EXPIRED";

  async function getInvoice() {
    setBusy(true);
    setError(null);
    try {
      await freshFlashInvoice(task.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function payConnected() {
    if (!inv) return;
    setError(null);
    try {
      await payAndGetProof(inv.raw); // Flash confirms the payment; the watcher closes the task
    } catch (e) {
      setError((e as Error).message || "The payment did not go through.");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold">
          {canPay
            ? `Pay ${task.assignee_name} in Flash`
            : "Payment requested in Flash"}
        </h3>
        <p className="mt-1 text-ink-soft">
          {canPay
            ? `${formatSats(task.budget_sats)} sats go straight into ${task.assignee_name}'s Flash cash wallet. Flash invoices last 60 seconds, so get one when you're ready to pay.`
            : `Waiting for ${task.poster_name} to pay. It lands in your Flash cash wallet as dollars, and the task closes itself.`}
        </p>
      </div>

      {(live || paid) && (
        <div className="flex items-start gap-3 rounded-xl bg-plum p-4 text-paper">
          <span
            className="mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-gold"
            aria-hidden
          />
          <div className="text-sm">
            <p className="font-display font-bold">
              {paid
                ? "Flash confirmed the payment. Closing the task…"
                : "Flash is watching this invoice"}
            </p>
            {!paid && (
              <p className="mt-0.5 text-[#cfc6e0]">
                No payment proof to copy. Flash tells Workbolt when it&apos;s
                paid.
              </p>
            )}
            {flash.error && (
              <p className="mt-1 font-semibold text-[#ffb4b4]">{flash.error}</p>
            )}
          </div>
        </div>
      )}

      {canPay && live && inv && (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Flash invoice QR code"
              className="w-full max-w-[220px] rounded-xl border border-line bg-white p-2"
            />
          )}
          <div className="min-w-0 flex-1 space-y-4">
            <p
              className={`font-display text-2xl font-extrabold ${secondsLeft <= 15 ? "text-danger" : "text-plum"}`}
              aria-live="polite"
            >
              {secondsLeft}s left
            </p>
            <Checks checks={checkInvoice(inv, task.budget_sats, true)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={payConnected} className="btn-gold">
                <Wallet size={16} /> Pay with a connected wallet
              </button>
              <a href={`lightning:${inv.raw}`} className="btn-ghost">
                <ExternalLink size={16} /> Open in wallet
              </a>
              <CopyButton value={inv.raw} />
            </div>
          </div>
        </div>
      )}

      {canPay && !live && !paid && (
        <div className="space-y-2">
          {inv && (
            <p className="text-sm font-semibold text-gold-deep">
              That invoice expired without payment. Nothing was taken.
            </p>
          )}
          <button
            type="button"
            onClick={getInvoice}
            disabled={busy}
            className="btn-gold"
          >
            <Zap size={16} fill="currentColor" />{" "}
            {busy
              ? "Asking Flash…"
              : inv
                ? "Get a new Flash invoice"
                : "Get Flash invoice"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function PaymentProof({ task }: { task: Task }) {
  const hash = useMemo(() => {
    try {
      return task.invoice ? decodeInvoice(task.invoice).paymentHash : null;
    } catch {
      return null;
    }
  }, [task.invoice]);
  const [checked, setChecked] = useState<{ key: string; ok: boolean } | null>(
    null,
  );
  const key = `${task.preimage}:${hash}`;
  useEffect(() => {
    if (!task.preimage || !hash) return;
    let live = true;
    preimageMatches(task.preimage, hash).then(
      (ok) => live && setChecked({ key, ok }),
    );
    return () => {
      live = false;
    };
  }, [task.preimage, hash, key]);
  const verified = !hash ? false : checked?.key === key ? checked.ok : null;

  if (task.paid_via === "flash")
    return (
      <p className="flex items-start gap-2 text-sm font-semibold text-teal">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        Flash confirmed this invoice was paid into {task.assignee_name}&apos;s
        Flash wallet.
      </p>
    );
  if (!task.preimage)
    return (
      <p className="text-sm text-ink-soft">
        Marked paid by {task.poster_name}. No payment proof was attached.
      </p>
    );
  if (verified === null) return null;
  return verified ? (
    <p className="flex items-start gap-2 text-sm font-semibold text-teal">
      <ShieldCheck size={16} className="mt-0.5 shrink-0" />
      Payment proof checked. The preimage unlocks this exact invoice.
    </p>
  ) : (
    <p className="text-sm font-semibold text-danger">
      The saved payment proof does not match the invoice.
    </p>
  );
}
