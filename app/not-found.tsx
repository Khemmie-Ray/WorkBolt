import type { Metadata } from "next";
import Link from "next/link";
import { LayoutGrid, Search } from "lucide-react";

export const metadata: Metadata = { title: "Page not found · Workbolt" };

const LEFT_PIECE =
  "[clip-path:polygon(0_0,58%_0,47%_52%,62%_48%,51%_100%,0_100%)]";
const RIGHT_PIECE =
  "[clip-path:polygon(58%_0,100%_0,100%_100%,51%_100%,62%_48%,47%_52%)]";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center py-10 text-center md:min-h-[calc(100dvh-5rem)]">
      <div className="group relative h-40 w-full max-w-xl sm:h-56" aria-hidden>
        {/* left piece */}
        <div className="absolute inset-0 drop-shadow-[0_18px_24px_rgb(36_22_58/0.18)]">
          <div className="absolute inset-0 overflow-hidden rounded-[22px]">
            <div className={`absolute inset-0 bg-paper ${LEFT_PIECE}`}>
              <div className="flex h-full flex-col justify-between p-4 text-left sm:p-6">
                <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft sm:text-xs">
                  Ticket No. 404
                </p>
                <p className="font-display text-[5.5rem] leading-[0.8] font-extrabold tracking-tight text-plum tabular-nums sm:text-[8.5rem]">
                  40
                </p>
                <p className="font-display text-xs font-semibold text-ink-soft sm:text-sm">
                  0 sats · not on the board
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* right piece, torn away */}
        <div className="absolute inset-0 translate-x-3 -translate-y-2 rotate-[7deg] transition-transform duration-500 ease-out group-hover:translate-x-5 group-hover:-translate-y-3 group-hover:rotate-[11deg] motion-reduce:transition-none sm:translate-x-5 sm:-translate-y-3">
          <div className="absolute inset-0 drop-shadow-[0_18px_24px_rgb(36_22_58/0.22)]">
            <div className="absolute inset-0 overflow-hidden rounded-[22px]">
              <div className={`absolute inset-0 bg-gold ${RIGHT_PIECE}`}>
                <div className="flex h-full items-end justify-end p-4 sm:p-6">
                  <p className="font-display text-[5.5rem] leading-[0.8] font-extrabold tracking-tight text-plum tabular-nums sm:text-[8.5rem]">
                    4
                  </p>
                </div>
                <span className="absolute right-4 top-4 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-plum/70 sm:right-6 sm:top-6 sm:text-xs">
                  Stub
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <h1 className="mt-12 max-w-lg font-display text-3xl font-bold text-balance sm:text-4xl">
        This page has been torn off the board
      </h1>
      <p className="mt-3 max-w-md text-ink-soft text-pretty">
        The link may be old, or the page never existed. Every open task is still
        on the board, waiting for someone to take it.
      </p>

      <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Link href="/tasks" className="btn-primary">
          <Search size={17} aria-hidden /> Browse open tasks
        </Link>
        <Link href="/" className="btn-ghost">
          <LayoutGrid size={17} aria-hidden /> Back to dashboard
        </Link>
      </div>
    </div>
  );
}
