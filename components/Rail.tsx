"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  LayoutGrid,
  Plus,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useMe } from "./Identity";
import { Mark } from "./Mark";

interface Item {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
}

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Dashboard",
    short: "Home",
    icon: LayoutGrid,
    match: (p) => p === "/",
  },
  {
    href: "/tasks",
    label: "Browse tasks",
    short: "Browse",
    icon: Search,
    match: (p) =>
      p === "/tasks" || (p.startsWith("/tasks/") && p !== "/tasks/new"),
  },
  {
    href: "/tasks/new",
    label: "Post a task",
    short: "Post",
    icon: Plus,
    match: (p) => p === "/tasks/new",
  },
  {
    href: "/work",
    label: "My work",
    short: "My work",
    icon: Briefcase,
    match: (p) => p === "/work",
  },
  {
    href: "/profile",
    label: "Profile and wallet",
    short: "Profile",
    icon: UserRound,
    match: (p) => p === "/profile",
  },
];

export function Rail() {
  const path = usePathname();
  const { me } = useMe();

  return (
    <>
      {/* Desktop: icon rail, labels fly out on hover and keyboard focus */}
      <nav
        aria-label="Main"
        className=" left-0 z-40 hidden w-25 flex-col items-center bg-plum py-5 md:flex lg:flex"
      >
        <Link href="/" aria-label="Workbolt home" className="mb-8">
          <Mark />
        </Link>
        <ul className="flex flex-1 flex-col items-center gap-2">
          {ITEMS.map((item) => {
            const active = item.match(path);
            const Icon = item.icon;
            const isPost = item.href === "/tasks/new";
            return (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "grid h-12 w-12 place-items-center rounded-2xl transition-colors",
                    isPost
                      ? "bg-gold text-plum hover:bg-[#ffb31a]"
                      : active
                        ? "bg-paper text-plum"
                        : "text-[#b9aed0] hover:bg-plum-2 hover:text-paper",
                  ].join(" ")}
                >
                  <Icon size={22} strokeWidth={2.2} aria-hidden />
                </Link>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-[calc(100%+14px)] top-1/2 -translate-x-1 -translate-y-1/2 whitespace-nowrap rounded-lg bg-paper px-3 py-1.5 font-display text-sm font-semibold text-plum opacity-0 shadow-ticket transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100"
                >
                  <span className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 bg-paper" />
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href="/profile"
          aria-label={me ? `Signed in as ${me.name}` : "Join the board"}
          className="grid h-10 w-10 place-items-center rounded-full border-2 border-[#4a3868] font-display text-sm font-bold text-paper"
        >
          {me ? me.name.slice(0, 1).toUpperCase() : "?"}
        </Link>
      </nav>

      {/* Mobile: bottom bar with captions, since there is no hover on touch */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#3a2a55] bg-plum pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {ITEMS.map((item) => {
            const active = item.match(path);
            const Icon = item.icon;
            const isPost = item.href === "/tasks/new";
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                    active ? "text-gold" : "text-[#b9aed0]"
                  }`}
                >
                  <span
                    className={
                      isPost
                        ? "-mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-gold text-plum shadow-lg"
                        : ""
                    }
                  >
                    <Icon
                      size={isPost ? 24 : 21}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  </span>
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
