"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { X } from "lucide-react";
import { supabase, NOT_CONFIGURED } from "@/lib/supabase";
import { getProfile, subscribe, updateMyProfile } from "@/lib/store";
import { isLightningAddress } from "@/lib/lightning";
import { checkFlashAccount } from "@/lib/flash-client";
import type { Profile } from "@/lib/types";

interface IdentityCtx {
  me: Profile | null;
  ready: boolean;
  askToJoin: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<IdentityCtx>({
  me: null,
  ready: false,
  askToJoin: () => {},
  signOut: async () => {},
});

export const useMe = () => useContext(Ctx);

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Follow the Google session. The client finishes the sign-in redirect by itself.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      if (!data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      if (!session) {
        setMe(null);
        setReady(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(() => {
    if (!userId) return;
    getProfile(userId)
      .then((p) => {
        setMe(p);
        setError(
          p ? null : "Your profile wasn't found. Sign out and sign in again.",
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setReady(true));
  }, [userId]);

  // Load the signed-in person's profile, and keep it fresh
  useEffect(() => {
    if (!userId) return;
    const first = setTimeout(loadProfile, 0);
    const stop = subscribe(loadProfile);
    return () => {
      clearTimeout(first);
      stop();
    };
  }, [userId, loadProfile]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  if (!supabase)
    return (
      <div className="grid min-h-dvh place-items-center bg-mist p-6">
        <div className="max-w-md rounded-[20px] bg-paper p-6 shadow-ticket">
          <h1 className="font-display text-xl font-bold">
            Workbolt needs its database
          </h1>
          <p className="mt-2 text-ink-soft">{NOT_CONFIGURED}</p>
        </div>
      </div>
    );

  return (
    <Ctx.Provider
      value={{ me, ready, askToJoin: () => setJoining(true), signOut }}
    >
      {children}
      {error && userId && (
        <p
          role="alert"
          className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl bg-danger p-3 text-sm font-semibold text-paper"
        >
          {error}
        </p>
      )}
      {joining && !me && <JoinDialog onClose={() => setJoining(false)} />}
      {me && !me.onboarded && <SetupDialog me={me} />}
    </Ctx.Provider>
  );
}

// ---------- join: Google sign-in ----------

function JoinDialog({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function google() {
    setBusy(true);
    setError(null);
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="join-title">
      <h2 id="join-title" className="font-display text-2xl font-bold">
        Join Workbolt
      </h2>
      <p className="mt-2 text-ink-soft">
        Sign in with Google to post tasks, take them on and get paid. Your name
        comes from Google, and you can change it next.
      </p>
      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="btn-ghost mt-6 w-full !py-3"
      >
        <GoogleG />
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && (
        <p className="mt-4 text-sm font-semibold text-danger">{error}</p>
      )}
    </Modal>
  );
}

// ---------- first sign-in: set up the profile ----------

function SetupDialog({ me }: { me: Profile }) {
  const [name, setName] = useState(me.name);
  const [skills, setSkills] = useState(me.skills ?? "");
  const [flash, setFlash] = useState(me.flash_account ?? "");
  const [address, setAddress] = useState(me.lightning_address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())
      return setError("Add the name people will see on your tasks.");
    if (address.trim() && !isLightningAddress(address))
      return setError(
        "A Lightning address looks like name@wallet.com. Leave it empty if you don't have one.",
      );
    setBusy(true);
    setError(null);
    try {
      const fa = flash.trim().replace(/^@/, "");
      if (fa) await checkFlashAccount(fa);
      await updateMyProfile(me.id, {
        name: name.trim(),
        skills: skills.trim() || null,
        flash_account: fa || null,
        lightning_address: address.trim() || null,
        onboarded: true,
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      await updateMyProfile(me.id, { onboarded: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal labelledBy="setup-title">
      <form onSubmit={save}>
        <h2 id="setup-title" className="font-display text-2xl font-bold">
          Set up your profile
        </h2>
        <p className="mt-2 text-ink-soft">
          This is what posters and freelancers see. You can change it any time.
        </p>
        <label className="field mt-6">
          <span>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </label>
        <label className="field mt-4">
          <span>What you can do (optional)</span>
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="Yoruba translation, flyer design, maths tutoring"
            maxLength={300}
          />
        </label>
        <fieldset className="mt-5 rounded-xl bg-mist p-4">
          <legend className="sr-only">Where you get paid</legend>
          <p className="font-display text-sm font-semibold">
            Where you get paid (optional)
          </p>
          <label className="field mt-3">
            <span>Flash username or wallet ID</span>
            <input
              value={flash}
              onChange={(e) => setFlash(e.target.value)}
              placeholder="yourname, or 0e227eec-40e9-…"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
          <label className="field mt-3">
            <span>Or a Lightning address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="you@getalby.com"
              inputMode="email"
              autoCapitalize="none"
            />
          </label>
        </fieldset>
        {error && (
          <p className="mt-4 text-sm font-semibold text-danger">{error}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save and continue"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={skip}
            disabled={busy}
          >
            Skip for now
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- shared ----------

function Modal({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose?: () => void;
  labelledBy: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-plum/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-[20px] bg-paper p-6 shadow-ticket sm:p-8"
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1 text-ink-soft hover:text-ink"
          >
            <X size={20} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Google's "G", required on Google sign-in buttons (not in lucide). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
