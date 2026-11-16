// File: app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { useMe } from "@/components/Identity";
import { updateMyProfile } from "@/lib/store";
import { isLightningAddress } from "@/lib/lightning";
import { checkFlashAccount } from "@/lib/flash-client";
import { shortAddress } from "@/lib/format";
import {
  checkTrezorProof,
  saveTrezorProof,
  signWithTrezor,
  statementFor,
} from "@/lib/trezor";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const { me, email, ready, askToJoin, signOut } = useMe();

  if (!ready) return null;

  if (!me)
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Profile and wallet
        </h1>
        <p className="mt-2 text-ink-soft">
          Sign in to post tasks, take them on and get paid.
        </p>
        <button onClick={askToJoin} className="btn-primary mt-5">
          Join with Google
        </button>
      </div>
    );

  return (
    <div className="max-w-2xl space-y-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">{me.name}</h1>
      {/* Remount when the saved profile changes, so the form shows what is stored */}
      <Details
        key={`${me.name}|${me.skills}|${me.flash_account}|${me.lightning_address}`}
        me={me}
      />
      <Trezor me={me} />
      <Account email={email} onSignOut={signOut} />
    </div>
  );
}

function Account({
  email,
  onSignOut,
}: {
  email: string | null;
  onSignOut: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="rounded-[20px] border border-line p-5 sm:p-7">
      <h2 className="font-display text-lg font-bold">Account</h2>
      <p className="mt-2 text-ink-soft">
        Signed in with Google
        {email ? (
          <>
            {" "}
            as <span className="font-semibold text-ink break-all">{email}</span>
          </>
        ) : null}
        . Your email isn&apos;t shown to other users.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onSignOut().finally(() => setBusy(false));
        }}
        className="btn-ghost mt-4"
      >
        <LogOut size={16} aria-hidden />
        {busy ? "Signing out…" : "Sign out"}
      </button>
      <p className="mt-3 text-sm text-ink-soft">
        This signs you out of Workbolt on this device. Your Google account stays
        signed in elsewhere, and next time Google lets you choose which account
        to use.
      </p>
      <p className="mt-4 text-sm">
        <Link
          href="/terms"
          className="font-semibold underline underline-offset-4"
        >
          Terms of Service
        </Link>
        <span className="mx-2 text-ink-soft">·</span>
        <Link
          href="/privacy"
          className="font-semibold underline underline-offset-4"
        >
          Privacy Policy
        </Link>
      </p>
    </section>
  );
}

function Details({ me }: { me: Profile }) {
  const [name, setName] = useState(me.name);
  const [skills, setSkills] = useState(me.skills ?? "");
  const [flash, setFlash] = useState(me.flash_account ?? "");
  const [address, setAddress] = useState(me.lightning_address ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())
      return setMsg({
        ok: false,
        text: "Add the name people see on your tasks.",
      });
    if (address.trim() && !isLightningAddress(address))
      return setMsg({
        ok: false,
        text: "A Lightning address looks like name@wallet.com.",
      });
    setBusy(true);
    setMsg(null);
    try {
      const fa = flash.trim().replace(/^@/, "");
      if (fa && fa !== me.flash_account) await checkFlashAccount(fa);
      await updateMyProfile(me.id, {
        name: name.trim(),
        skills: skills.trim() || null,
        flash_account: fa || null,
        lightning_address: address.trim() || null,
        onboarded: true,
      });
      setMsg({ ok: true, text: "Profile saved." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="space-y-5 rounded-[20px] bg-paper p-5 shadow-ticket sm:p-7"
    >
      <label className="field">
        <span>Your name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
        <small>Shown on every task you post or take on.</small>
      </label>
      <label className="field">
        <span>What you can do</span>
        <textarea
          rows={3}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Igbo translation, flyer design, maths tutoring"
          maxLength={300}
        />
      </label>

      <fieldset className="space-y-4 rounded-xl bg-mist p-4">
        <legend className="sr-only">Where you get paid</legend>
        <p className="font-display text-sm font-semibold">Where you get paid</p>
        <label className="field">
          <span>Flash username or wallet ID</span>
          <input
            value={flash}
            onChange={(e) => setFlash(e.target.value)}
            placeholder="yourname, or 0e227eec-40e9-…"
            autoCapitalize="none"
            spellCheck={false}
          />
          <small>
            With Flash, posters pay straight into your Flash cash wallet and the
            task closes itself. Workbolt checks the account with Flash when you
            save.
          </small>
        </label>
        <label className="field">
          <span>Lightning address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="you@getalby.com"
            inputMode="email"
            autoCapitalize="none"
          />
          <small>
            Workbolt asks it for an invoice of the exact agreed price when you
            finish a task.
          </small>
        </label>
      </fieldset>

      {msg && (
        <p
          className={`text-sm font-semibold ${msg.ok ? "text-teal" : "text-danger"}`}
        >
          {msg.text}
        </p>
      )}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

function Trezor({ me }: { me: Profile }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ sig: string; ok: boolean } | null>(
    null,
  );

  // Re-check the saved signature on the server, so a stale badge is flagged
  useEffect(() => {
    const { trezor_address: a, trezor_message: m, trezor_signature: s } = me;
    if (!a || !m || !s) return;
    let live = true;
    checkTrezorProof(m, a, s)
      .then((ok) => live && setChecked({ sig: s, ok }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [me]);
  const broken = checked?.sig === me.trezor_signature && !checked.ok;

  async function prove() {
    setBusy(true);
    setError(null);
    try {
      const message = statementFor(me.name, me.id);
      const { address, signature } = await signWithTrezor(message);
      await saveTrezorProof(message, address, signature);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[20px] bg-plum p-5 text-paper sm:p-7">
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-gold" size={22} />
        <h2 className="font-display text-lg font-bold">Trezor verification</h2>
      </div>
      {me.trezor_address ? (
        <div className="mt-3 space-y-2">
          <p>
            {broken
              ? "The saved signature no longer checks out. Sign again."
              : "This profile is signed by a key held on a Trezor. Others see a verified badge next to your name."}
          </p>
          <p className="text-sm text-[#cfc6e0]">
            Cold storage address{" "}
            <span className="font-mono">{shortAddress(me.trezor_address)}</span>
            . Move earnings here from your Lightning wallet when they add up.
          </p>
          <button
            onClick={prove}
            disabled={busy}
            className="mt-2 text-sm font-semibold text-gold underline underline-offset-4"
          >
            {busy ? "Waiting for your Trezor…" : "Sign again"}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <p className="text-[#e4ddef]">
            Sign a short statement with your Trezor. It proves this profile is
            yours without sharing any keys, and gives you a cold storage address
            for your earnings.
          </p>
          <button onClick={prove} disabled={busy} className="btn-gold">
            {busy ? "Confirm on your Trezor…" : "Verify with Trezor"}
          </button>
        </div>
      )}
      {error && (
        <p className="mt-3 text-sm font-semibold text-[#ffb4b4]">{error}</p>
      )}
    </section>
  );
}
