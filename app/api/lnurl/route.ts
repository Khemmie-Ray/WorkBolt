// File: app/api/lnurl/route.ts
import { NextResponse } from "next/server";
import { invoiceFromAddress } from "@/lib/server/lnurl";

/** Lightning address to invoice. Runs on the server so wallets without CORS headers still work. */
export async function POST(req: Request) {
  try {
    const { address, sats, comment } = (await req.json()) as { address: string; sats: number; comment?: string };
    return NextResponse.json({ invoice: await invoiceFromAddress(address, sats, comment) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}