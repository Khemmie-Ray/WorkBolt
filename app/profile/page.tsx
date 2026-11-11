"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useMe } from "@/components/Identity";
import { useProfiles } from "@/lib/hooks";
import { resetDemo, updateProfile } from "@/lib/store";
import { isLive } from "@/lib/supabase";
import { isLightningAddress } from "@/lib/lightning";
import { shortAddress } from "@/lib/format";
import { signWithTrezor, statementFor, verifyOnServer } from "@/lib/trezor";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const { me, ready, askToJoin, switchTo } = useMe();
  const { data: profiles } = useProfiles();

  if (!ready) return null;

  return (
    <div className="max-w-2xl space-y-10">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        {me ? me.name : "Profile and wallet"}
      </h1>

      {me ? (
        <>
          <Details me={me} />
          <Trezor me={me} />
        </>
      ) : (
        <div>
          <p className="text-ink-soft">
            Join to post tasks, accept them and get paid.
          </p>
          <button onClick={askToJoin} className="btn-primary mt-4">
            Join the board
          </button>
        </div>
      )}

      {profiles.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-bold">Switch profile</h2>
          <p className="mt-1 text-ink-soft">
            Handy for demos: act as the person posting in one tab and the
            freelancer in another.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => switchTo(p.id)}
                aria-pressed={me?.id === p.id}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${
                  me?.id === p.id
                    ? "border-plum bg-plum text-paper"
                    : "border-line bg-paper hover:border-ink-soft"
                }`}
              >
                {p.name}
              </button>
            ))}
            {me && (
              <button
                onClick={() => switchTo(null)}
                className="px-2 text-sm font-semibold text-ink-soft underline underline-offset-4"
              >
                Sign out
              </button>
            )}
          </div>
        </section>
      )}

      {!isLive && (
        <section className="rounded-[18px] border-2 border-dashed border-line p-5">
          <h2 className="font-display font-bold">Demo mode</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Tasks are saved in this browser only. Add your Supabase keys to
            share one board between devices.
          </p>
          <button
            onClick={() => {
              resetDemo();
              switchTo(null);
            }}
            className="mt-3 text-sm font-semibold underline underline-offset-4"
          >
            Reset demo tasks
          </button>
        </section>
      )}
    </div>
  );
}

function Details({ me }: { me: Profile }) {
  const [address, setAddress] = useState(me.lightning_address ?? "");
  const [skills, setSkills] = useState(me.skills ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setAddress(me.lightning_address ?? "");
    setSkills(me.skills ?? "");
  }, [me.id, me.lightning_address, me.skills]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (address && !isLightningAddress(address))
      return setMsg({
        ok: false,
        text: "A Lightning address looks like name@wallet.com.",
      });
    try {
      await updateProfile(me.id, {
        lightning_address: address.trim() || null,
        skills: skills.trim() || null,
      });
      setMsg({ ok: true, text: "Profile saved." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <form
      onSubmit={save}
      className="space-y-5 rounded-[20px] bg-paper p-5 shadow-ticket sm:p-7"
    >
      <label className="field">
        <span>Lightning address</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="you@flashapp.me"
          inputMode="email"
        />
        <small>
          Find it in your wallet under Receive. With it saved, the board can
          create an invoice for the exact agreed price when you finish a task.
        </small>
      </label>
      <label className="field">
        <span>What you can do</span>
        <textarea
          rows={3}
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Igbo translation, flyer design, GCSE maths"
        />
      </label>
      {msg && (
        <p
          className={`text-sm font-semibold ${msg.ok ? "text-teal" : "text-danger"}`}
        >
          {msg.text}
        </p>
      )}
      <button className="btn-primary">Save profile</button>
    </form>
  );
}

function Trezor({ me }: { me: Profile }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean | null>(null);

  useEffect(() => {
    if (me.trezor_address && me.trezor_message && me.trezor_signature)
      verifyOnServer(
        me.trezor_message,
        me.trezor_address,
        me.trezor_signature,
      ).then(setChecked);
  }, [me.trezor_address, me.trezor_message, me.trezor_signature]);

  async function prove() {
    setBusy(true);
    setError(null);
    try {
      const message = statementFor(me.name, me.id);
      const { address, signature } = await signWithTrezor(message);
      if (!(await verifyOnServer(message, address, signature)))
        throw new Error("The signature did not verify. Try again.");
      await updateProfile(me.id, {
        trezor_address: address,
        trezor_message: message,
        trezor_signature: signature,
      });
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
            {checked === false
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
