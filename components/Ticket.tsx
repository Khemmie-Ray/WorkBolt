"use client";

import Link from "next/link";
import {
  GraduationCap,
  Languages,
  Palette,
  PenLine,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Category, Task, TaskStatus } from "@/lib/types";
import { CATEGORIES, STATUS_LABEL } from "@/lib/types";
import { deadlineText, formatNaira, formatSats } from "@/lib/format";
import { useNairaPerSat } from "@/lib/hooks";
import { BondChip } from "./Bond";

const CAT_ICON: Record<Category, typeof Palette> = {
  design: Palette,
  translation: Languages,
  tutoring: GraduationCap,
  writing: PenLine,
  other: Sparkles,
};

export function CategoryTag({ category }: { category: Category }) {
  const Icon = CAT_ICON[category];
  const label = CATEGORIES.find((c) => c.value === category)?.label ?? category;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
      <Icon size={15} aria-hidden />
      {label}
    </span>
  );
}

const STEPS: TaskStatus[] = ["open", "in_progress", "completed"];
const STEP_COLOR: Record<TaskStatus, string> = {
  open: "bg-gold",
  in_progress: "bg-iris",
  completed: "bg-teal",
};

/** Three-stop track: open, in progress, completed. */
export function StatusRail({
  status,
  invoiced,
}: {
  status: TaskStatus;
  invoiced?: boolean;
}) {
  const at = STEPS.indexOf(status);
  const label =
    status === "in_progress" && invoiced
      ? "Invoice sent"
      : STATUS_LABEL[status];
  return (
    <div className="flex items-center gap-3" aria-label={`Status: ${label}`}>
      <div className="flex items-center" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            {i > 0 && (
              <span
                className={`h-0.5 w-5 ${i <= at ? STEP_COLOR[status] : "bg-line"}`}
              />
            )}
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                i < at
                  ? STEP_COLOR[status]
                  : i === at
                    ? `${STEP_COLOR[status]} ring-4 ring-offset-0 ${ringFor(status)}`
                    : "bg-line"
              }`}
            />
          </div>
        ))}
      </div>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}

function ringFor(s: TaskStatus) {
  return s === "open"
    ? "ring-gold-wash"
    : s === "in_progress"
      ? "ring-iris-wash"
      : "ring-teal-wash";
}

const STUB_BG: Record<TaskStatus, string> = {
  open: "bg-gold",
  in_progress: "bg-iris-wash",
  completed: "bg-teal-wash",
};

export function SatsStub({
  task,
  size = "md",
}: {
  task: Task;
  size?: "md" | "lg";
}) {
  const rate = useNairaPerSat();
  const big = size === "lg";
  return (
    <div
      className={`relative flex flex-wrap items-baseline justify-center gap-x-2 overflow-hidden px-5 text-center sm:flex-col sm:flex-nowrap sm:items-center ${STUB_BG[task.status]} ${
        big
          ? "py-5 sm:min-w-[220px] sm:py-8"
          : "py-3.5 sm:min-w-[150px] sm:py-5"
      }`}
    >
      <Zap
        size={big ? 22 : 16}
        className="mb-1 self-center text-plum"
        fill="currentColor"
        aria-hidden
      />
      <span
        className={`font-display font-extrabold leading-none tracking-tight text-plum ${
          big ? "text-5xl" : "text-3xl"
        }`}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formatSats(task.budget_sats)}
      </span>
      <span className="font-display text-sm font-semibold text-plum sm:mt-1">
        sats
      </span>
      {rate && (
        <span className="basis-full text-xs text-plum/70 sm:mt-1">
          about {formatNaira(task.budget_sats * rate)}
        </span>
      )}
      {task.status === "completed" && (
        <span
          className="stamp-in absolute right-3 top-3 rounded-md border-[3px] border-teal bg-teal-wash/80 px-2 py-0.5 font-display text-lg font-extrabold leading-tight text-teal"
          style={{ transform: "rotate(-8deg)" }}
        >
          Paid
        </span>
      )}
    </div>
  );
}

export function TicketCard({ task }: { task: Task }) {
  const due = deadlineText(task.deadline);
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group flex flex-col overflow-hidden rounded-[18px] bg-paper shadow-ticket outline-offset-4 transition-transform hover:-translate-y-0.5 sm:flex-row"
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        <CategoryTag category={task.category} />
        <h3 className="font-display text-lg font-bold leading-snug group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
          {task.title}
        </h3>
        <p className="line-clamp-2 text-ink-soft">{task.description}</p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusRail status={task.status} invoiced={!!task.invoice} />
            <BondChip task={task} />
          </div>
          <span className="text-sm text-ink-soft">
            {task.poster_name},{" "}
            <span
              className={
                due.urgent && task.status !== "completed"
                  ? "font-semibold text-danger"
                  : ""
              }
            >
              {task.status === "completed" ? "done" : due.text.toLowerCase()}
            </span>
          </span>
        </div>
      </div>
      <div className="perf hidden sm:block" />
      <div className="perf-h sm:hidden" />
      <SatsStub task={task} />
    </Link>
  );
}
