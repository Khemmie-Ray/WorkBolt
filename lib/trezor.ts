"use client";

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
              : "https://sats-for-skills.app",
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

export async function verifyOnServer(
  message: string,
  address: string,
  signature: string,
): Promise<boolean> {
  const res = await fetch("/api/verify-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, address, signature }),
  });
  const data = await res.json();
  return data.valid === true;
}
