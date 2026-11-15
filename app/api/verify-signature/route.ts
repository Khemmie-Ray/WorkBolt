// File: app/api/verify-signature/route.ts
import { NextResponse } from "next/server";
import bitcoinMessage from "bitcoinjs-message";
import { admin, HttpError, requireCaller } from "@/lib/server/supabase-admin";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<
    string,
    string | undefined
  >;
  const { message, address, signature } = body;
  if (!message || !address || !signature)
    return NextResponse.json(
      { error: "Missing signature details." },
      { status: 400 },
    );

  let valid = false;
  try {
    valid = bitcoinMessage.verify(message, address, signature);
  } catch {
    valid = false;
  }
  if (body.action !== "save") return NextResponse.json({ valid });

  try {
    const me = await requireCaller(req);
    if (!valid)
      return NextResponse.json(
        { error: "The Trezor signature didn't check out." },
        { status: 400 },
      );
    if (!message.includes(`Profile ${me}.`))
      return NextResponse.json(
        { error: "That statement is for a different profile." },
        { status: 403 },
      );
    const { error } = await admin()
      .from("profiles")
      .update({
        trezor_address: address,
        trezor_message: message,
        trezor_signature: signature,
      })
      .eq("id", me);
    if (error) throw new Error(error.message);
    return NextResponse.json({ valid: true });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
