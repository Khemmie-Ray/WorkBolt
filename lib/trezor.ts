"use client";

import { api } from "./api";
import { notifyChanged } from "./store";

const PATH = "m/84'/0'/0'/0/0";

let ready: Promise<typeof import("@trezor/connect-web").default> | null = null;

function connect() {
  if (!ready) {
    ready = import("@trezor/connect-web").then(async (mod) => {
      const TrezorConnect = mod.default;
      await TrezorConnect.init({
        manifest: {
          appName: "Workbolt",
          appUrl:
            typeof window !== "undefined"
              ? window.location.origin
              : "https://workbolt.app",
          email:
            process.env.NEXT_PUBLIC_TREZOR_MANIFEST_EMAIL ?? "team@example.com",
        },
      });
      return TrezorConnect;
    });
  }
  return ready;
}

export function statementFor(name: string, profileId: string) {
  return `Workbolt: I am ${name}. Profile ${profileId}. ${new Date().toISOString().slice(0, 10)}`;
}

export async function signWithTrezor(
  message: string,
): Promise<{ address: string; signature: string }> {
  const TrezorConnect = await connect();
  const res = await TrezorConnect.signMessage({
    path: PATH,
    coin: "btc",
    message,
  });
  if (!res.success) {
    const e = res.error as unknown as
      | { message?: string; error?: string }
      | string;
    const text = typeof e === "string" ? e : e?.message || e?.error;
    throw new Error(text || "The Trezor request was cancelled.");
  }
  return { address: res.payload.address, signature: res.payload.signature };
}

/** The server checks the signature names this profile, verifies it, and saves the badge. */
export async function saveTrezorProof(
  message: string,
  address: string,
  signature: string,
) {
  await api("/api/verify-signature", {
    action: "save",
    message,
    address,
    signature,
  });
  notifyChanged();
}

/** Re-check a saved signature, for showing whether the badge still holds. */
export async function checkTrezorProof(
  message: string,
  address: string,
  signature: string,
): Promise<boolean> {
  const data = await api<{ valid: boolean }>("/api/verify-signature", {
    action: "check",
    message,
    address,
    signature,
  });
  return data.valid === true;
}
