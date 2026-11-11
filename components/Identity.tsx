"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createProfile, getProfile, subscribe } from "@/lib/store";
import type { Profile } from "@/lib/types";
import { isLightningAddress } from "@/lib/lightning";

const KEY = "sfs.me";

interface IdentityCtx {
  me: Profile | null;
  ready: boolean;
  switchTo: (id: string | null) => void;
  askToJoin: () => void;
}

const Ctx = createContext<IdentityCtx>({
  me: null,
  ready: false,
  switchTo: () => {},
  askToJoin: () => {},
});

export const useMe = () => useContext(Ctx);

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    const id = localStorage.getItem(KEY);
    setMe(id ? await getProfile(id).catch(() => null) : null);
    setReady(true);
  }, []);

  useEffect(() => {
    load();
    return subscribe(load);
  }, [load]);

  const switchTo = (id: string | null) => {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
    load();
  };

  return (
    <Ctx.Provider
      value={{ me, ready, switchTo, askToJoin: () => setJoining(true) }}
    >
      {children}
      {joining && (
        <JoinDialog
          onClose={() => setJoining(false)}
          onJoined={(p) => {
            switchTo(p.id);
            setJoining(false);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function JoinDialog({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (p: Profile) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())
      return setError("Add the name people will see on your tasks.");
    if (address && !isLightningAddress(address))
      return setError(
        "A Lightning address looks like name@wallet.com. Leave it empty if you don't have one yet.",
      );
    setBusy(true);
    try {
      onJoined(await createProfile(name.trim(), address.trim() || null));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-plum/50 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[20px] bg-paper p-6 shadow-ticket sm:p-8"
        role="dialog"
        aria-labelledby="join-title"
      >
        <h2 id="join-title" className="font-display text-2xl font-bold">
          Join the board
        </h2>
        <p className="mt-2 text-ink-soft">
          No password. Your name shows on tasks you post or accept.
        </p>
        <label className="field mt-6">
          <span>Your name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tolu"
          />
        </label>
        <label className="field mt-4">
          <span>Lightning address (optional)</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="tolu@flashapp.me"
            inputMode="email"
          />
          <small>
            Lets the board create invoices for you at the exact agreed price.
          </small>
        </label>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Joining…" : "Join"}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
