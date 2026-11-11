// File: app/api/verify-signature/route.ts
import { NextResponse } from "next/server";
import bitcoinMessage from "bitcoinjs-message";

export async function POST(req: Request) {
  try {
    const { message, address, signature } = (await req.json()) as {
      message: string;
      address: string;
      signature: string;
    };
    if (!message || !address || !signature)
      return NextResponse.json({ valid: false }, { status: 400 });
    const valid = bitcoinMessage.verify(message, address, signature);
    return NextResponse.json({ valid });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
