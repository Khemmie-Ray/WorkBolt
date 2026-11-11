"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { TicketCard } from "@/components/Ticket";
import { useTasks } from "@/lib/hooks";
import { isListed } from "@/lib/escrow";
import {
  CATEGORIES,
  STATUS_LABEL,
  type Category,
  type TaskStatus,
} from "@/lib/types";

type StatusFilter = TaskStatus | "all";
const STATUS_FILTERS: StatusFilter[] = [
  "open",
  "in_progress",
  "completed",
  "all",
];

export default function Browse() {
  const { data: all, loading, error } = useTasks();
  const tasks = useMemo(() => all.filter(isListed), [all]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("open");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (status === "all" || t.status === status) &&
        (cat === "all" || t.category === cat) &&
        (!term || `${t.title} ${t.description}`.toLowerCase().includes(term)),
    );
  }, [tasks, q, cat, status]);

  const count = (s: StatusFilter) =>
    s === "all" ? tasks.length : tasks.filter((t) => t.status === s).length;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        Browse tasks
      </h1>
      <p className="mt-2 text-ink-soft">
        Find a job that fits your skills. Every price is in sats.
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="relative block max-w-xl">
          <span className="sr-only">Search tasks</span>
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft"
            size={18}
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Yoruba, logo, maths…"
            className="w-full rounded-full border border-line bg-paper py-3 pl-11 pr-4 focus:border-plum focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`rounded-full px-4 py-1.5 font-display text-sm font-semibold transition-colors ${
                status === s
                  ? "bg-plum text-paper"
                  : "bg-paper text-ink hover:bg-white"
              }`}
            >
              {s === "all" ? "All" : STATUS_LABEL[s]}{" "}
              <span className="opacity-60">{count(s)}</span>
            </button>
          ))}
        </div>

        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          role="group"
          aria-label="Category"
        >
          {[{ value: "all" as const, label: "Every skill" }, ...CATEGORIES].map(
            (c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                aria-pressed={cat === c.value}
                className={`shrink-0 rounded-full border px-3.5 py-1 text-sm font-semibold transition-colors ${
                  cat === c.value
                    ? "border-plum text-plum"
                    : "border-line text-ink-soft hover:border-ink-soft"
                }`}
              >
                {c.label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {loading && <p className="text-ink-soft">Loading tasks…</p>}
        {error && <p className="text-danger">Tasks could not load: {error}</p>}
        {!loading && shown.length === 0 && (
          <div className="rounded-[18px] border-2 border-dashed border-line p-8 lg:col-span-2">
            <p className="font-display text-lg font-bold">
              No tasks match these filters.
            </p>
            <p className="mt-1 text-ink-soft">
              Try another skill or status, or{" "}
              <Link
                href="/tasks/new"
                className="font-semibold text-ink underline"
              >
                post a task
              </Link>{" "}
              yourself.
            </p>
          </div>
        )}
        {shown.map((t) => (
          <TicketCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  );
}
