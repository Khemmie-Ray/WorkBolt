"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Lock, LockOpen, Wallet } from "lucide-react";
import { CopyButton, useQR } from "./Invoice";
import {
  escrowAction,
  payWithConnectedWallet,
  useEscrow,
} from "@/lib/server/escrow-clients";
import { formatDateTime, formatSats } from "@/lib/format";
import { bondFor } from "@/lib/escrow";
import type { Task } from "@/lib/types";

export function BondChip({ task }: { task: Task }) {
  if (!task.bond_sats || !task.bond_status || task.bond_status === "none")
    return null;
  const locked = task.bond_status === "locked";
  if (
    !locked &&
    task.bond_status !== "returned" &&
    task.bond_status !== "claimed"
  )
    return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        locked ? "bg-teal-wash text-teal" : "bg-mist text-ink-soft"
      }`}
      title={
        locked
          ? "The poster has locked part of the price. It is held in the Lightning network until the job closes."
          : undefined
      }
    >
      {locked ? (
        <Lock size={12} aria-hidden />
      ) : (
        <LockOpen size={12} aria-hidden />
      )}
      {formatSats(task.bond_sats)} sats{" "}
      {locked
        ? "committed"
        : task.bond_status === "claimed"
          ? "bond paid out"
          : "bond returned"}
    </span>
  );
}

/** Poster locks the bond before the task goes on the board. */
export function BondLock({ task }: { task: Task }) {
  const { view, setView, error: pollError } = useEscrow(task.id, true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qr = useQR(view?.status === "awaiting" ? view.invoice : null);

  async function lock() {
    setBusy(true);
    setError(null);
    try {
      setView(
        await escrowAction(task.id, "create", {
          budget_sats: task.budget_sats,
          title: task.title,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function connectAndPay() {
    if (!view) return;
    setError(null);
    try {
      await payWithConnectedWallet(view.invoice);
    } catch (e) {
      setError((e as Error).message || "No wallet was connected.");
    }
  }

  const bond = view?.bond_sats ?? bondFor(task.budget_sats);

  if (view?.status === "locked")
    return (
      <div className="space-y-2">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold">
          <Lock size={18} className="text-teal" /> {formatSats(view.bond_sats)}{" "}
          sats committed
        </h3>
        <p className="text-ink-soft">
          Your task is on the board. The commitment is held in the Lightning
          network, not by Workbolt or the freelancer. It comes back to you when
          you pay for the work and add the payment proof.
        </p>
      </div>
    );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold">
          Commit {formatSats(bond)} sats to list this task
        </h3>
        <p className="mt-1 text-ink-soft">
          Freelancers only see tasks with a commitment, so they know the money
          is real. It isn&apos;t spent: it stays locked and returns to you when
          you pay for the work.
        </p>
      </div>

      {!view || view.status === "expired" ? (
        <>
          {view?.status === "expired" && (
            <p className="text-sm font-semibold text-gold-deep">
              The last lock expired and nothing was taken. Create a new one.
            </p>
          )}
          <button className="btn-gold" disabled={busy} onClick={lock}>
            <Lock size={16} />{" "}
            {busy ? "Creating…" : `Lock ${formatSats(bond)} sats`}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Commitment invoice QR code"
              className="w-full max-w-[200px] rounded-xl border border-line bg-white p-2"
            />
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-iris">
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-iris"
                aria-hidden
              />{" "}
              Waiting for your payment…
            </p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-gold" onClick={connectAndPay}>
                <Wallet size={16} /> Pay with a connected wallet
              </button>
              <a href={`lightning:${view.invoice}`} className="btn-ghost">
                <ExternalLink size={16} /> Open in wallet
              </a>
              <CopyButton value={view.invoice} />
            </div>
            <p className="text-xs text-ink-soft">
              Your wallet may show this payment as pending. That is the lock
              working.
            </p>
          </div>
        </div>
      )}
      {(error || pollError) && (
        <p className="text-sm font-semibold text-danger">
          {error ?? pollError}
        </p>
      )}
    </div>
  );
}

/** Freelancer can claim the bond if the poster goes quiet after delivery. */
export function ClaimBond({ task }: { task: Task }) {
  const { view, setView } = useEscrow(task.id, task.bond_status === "locked");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  if (!view || view.status !== "locked" || !view.claimable_at || nowMs === null)
    return null;
  const ready = nowMs >= new Date(view.claimable_at).getTime();

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      setView(await escrowAction(task.id, "claim"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl bg-mist p-4">
      <p className="text-sm">
        {task.poster_name} committed{" "}
        <strong>{formatSats(view.bond_sats)} sats</strong>.{" "}
        {ready
          ? "They haven't paid since you delivered. You can claim the commitment."
          : `If they haven't paid by ${formatDateTime(view.claimable_at)}, you can claim it.`}
      </p>
      {ready && (
        <button className="btn-primary" disabled={busy} onClick={claim}>
          {busy ? "Claiming…" : `Claim ${formatSats(view.bond_sats)} sats`}
        </button>
      )}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

/** Invisible: refreshes a bond from the wallet so a lock paid on another device shows up. */
export function EscrowSync({ taskId }: { taskId: string }) {
  useEscrow(taskId, true);
  return null;
}
