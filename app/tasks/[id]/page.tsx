"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { useMe } from "@/components/Identity";
import { CategoryTag, SatsStub, StatusRail } from "@/components/Ticket";
import { InvoiceForm, InvoicePay, PaymentProof } from "@/components/Invoice";
import { Person } from "@/components/Person";
import { BondChip, BondLock, ClaimBond, EscrowSync } from "@/components/Bond";
import { isListed } from "@/lib/escrow";
import { useTask } from "@/lib/hooks";
import { acceptTask, releaseTask } from "@/lib/store";
import { deadlineText, formatDateTime, formatSats } from "@/lib/format";
import { paymentRequested, type Profile, type Task } from "@/lib/types";

export default function TaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: task, loading } = useTask(id);
  const { me } = useMe();

  if (loading) return <p className="text-ink-soft">Loading task…</p>;
  if (!task)
    return (
      <div className="mx-auto mt-6 max-w-xl rounded-[22px] border-2 border-dashed border-line p-6 text-center sm:mt-16 sm:p-10">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
          This task has left the board.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-ink-soft">
          The poster may have taken it down, or the link is missing a few
          characters. Check the link, or find something else to work on.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/tasks" className="btn-primary">
            Browse open tasks
          </Link>
          <Link href="/tasks/new" className="btn-ghost">
            Post a task
          </Link>
        </div>
      </div>
    );

  const due = deadlineText(task.deadline);
  const bondOpen =
    task.bond_status === "awaiting" || task.bond_status === "locked";

  return (
    <div>
      {bondOpen && !(me?.id === task.poster_id && task.status === "open") && (
        <EscrowSync taskId={task.id} />
      )}
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 font-display font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft size={16} /> All tasks
      </Link>

      <article className="mt-4 flex flex-col overflow-hidden rounded-[22px] bg-paper shadow-ticket sm:flex-row">
        <div className="flex flex-1 flex-col gap-4 p-6 sm:p-8">
          <CategoryTag category={task.category} />
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-[2rem]">
            {task.title}
          </h1>
          <p className="text-ink-soft">
            Posted by <Person id={task.poster_id} name={task.poster_name} />
            {task.assignee_id && (
              <>
                {", taken by "}
                <Person id={task.assignee_id} name={task.assignee_name} />
              </>
            )}
            {task.status !== "completed" && (
              <>
                {". "}
                <span className={due.urgent ? "font-semibold text-danger" : ""}>
                  {due.text}
                </span>
              </>
            )}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
            <StatusRail
              status={task.status}
              invoiced={paymentRequested(task)}
            />
            <BondChip task={task} />
          </div>
        </div>
        <div className="perf hidden sm:block" />
        <div className="perf-h sm:hidden" />
        <SatsStub task={task} size="lg" />
      </article>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-8">
          <section>
            <h2 className="font-display text-lg font-bold">The job</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-lg leading-relaxed">
              {task.description}
            </p>
          </section>

          {task.delivery_note && (
            <section>
              <h2 className="font-display text-lg font-bold">Delivered work</h2>
              <p className="mt-2 max-w-prose whitespace-pre-line break-words">
                {linkify(task.delivery_note)}
              </p>
            </section>
          )}

          <section>
            <h2 className="font-display text-lg font-bold">Timeline</h2>
            <Timeline task={task} />
          </section>
        </div>

        <aside className="order-first h-fit rounded-[20px] bg-paper p-5 shadow-ticket sm:p-7 lg:order-none">
          <Actions task={task} me={me} />
        </aside>
      </div>
    </div>
  );
}

function Actions({ task, me }: { task: Task; me: Profile | null }) {
  const { askToJoin } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Replacing the payment request ends by itself once a new one is saved
  const [replacingFrom, setReplacingFrom] = useState<string | null | undefined>(
    undefined,
  );
  const replacing =
    replacingFrom !== undefined && replacingFrom === task.invoiced_at;
  const requested = paymentRequested(task);

  const isPoster = me?.id === task.poster_id;
  const isAssignee = me?.id === task.assignee_id;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const contact = (
    <p className="flex items-start gap-2 rounded-xl bg-mist p-3.5 text-sm">
      <MessageCircle size={16} className="mt-0.5 shrink-0" />
      <span>
        Contact {task.poster_name}:{" "}
        <strong className="break-all">{task.contact}</strong>
      </span>
    </p>
  );

  if (task.status === "completed")
    return (
      <div className="space-y-3">
        <h3 className="font-display text-lg font-bold">Completed and paid</h3>
        <p className="text-ink-soft">
          {task.poster_name} paid {task.assignee_name}{" "}
          {formatSats(task.budget_sats)} sats
          {task.completed_at ? ` on ${formatDateTime(task.completed_at)}` : ""}.
        </p>
        <PaymentProof task={task} />
      </div>
    );

  if (task.status === "open") {
    const bonded = task.bond_status && task.bond_status !== "none";
    if (isPoster && bonded) return <BondLock task={task} />;
    if (!isListed(task))
      return (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold">
            Not on the board yet
          </h3>
          <p className="text-ink-soft">
            {task.poster_name} hasn&apos;t committed sats to this task, so it
            can&apos;t be accepted yet.
          </p>
        </div>
      );
    if (isPoster)
      return (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-bold">
            Waiting for a freelancer
          </h3>
          <p className="text-ink-soft">
            Your task is live. Freelancers will reach you at {task.contact} with
            questions, and it moves to in progress once someone accepts.
          </p>
        </div>
      );
    return (
      <div className="space-y-4">
        <h3 className="font-display text-lg font-bold">Can you do this?</h3>
        <p className="text-ink-soft">
          Ask {task.poster_name} anything first. When you accept, the task is
          yours and others can no longer take it.
        </p>
        {contact}
        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        {me ? (
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => run(() => acceptTask(task.id))}
          >
            {busy
              ? "Accepting…"
              : `Accept for ${formatSats(task.budget_sats)} sats`}
          </button>
        ) : (
          <button className="btn-primary" onClick={askToJoin}>
            Join to accept this task
          </button>
        )}
      </div>
    );
  }

  // in progress
  if (isAssignee) {
    if (!requested || replacing)
      return (
        <div className="space-y-5">
          <InvoiceForm task={task} me={me!} replacing={replacing} />
          {!requested && (
            <button
              className="text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-danger"
              disabled={busy}
              onClick={() => run(() => releaseTask(task.id))}
            >
              I can&apos;t finish this, give the task back
            </button>
          )}
          {error && (
            <p className="text-sm font-semibold text-danger">{error}</p>
          )}
        </div>
      );
    return (
      <div className="space-y-4">
        <InvoicePay task={task} canPay={false} />
        <ClaimBond task={task} />
        <button
          className="text-sm font-semibold text-ink-soft underline underline-offset-4"
          onClick={() => setReplacingFrom(task.invoiced_at)}
        >
          {task.invoice_source === "flash"
            ? "Change how I get paid"
            : "Replace the invoice"}
        </button>
      </div>
    );
  }

  if (isPoster) {
    if (requested) return <InvoicePay task={task} canPay />;
    return (
      <div className="space-y-3">
        <h3 className="font-display text-lg font-bold">
          {task.assignee_name} is on it
        </h3>
        <p className="text-ink-soft">
          When the work is delivered, their payment request shows up here. You
          pay from your own wallet; Workbolt never holds your sats.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-bold">
        Taken by {task.assignee_name}
      </h3>
      <p className="text-ink-soft">
        This task is in progress.{" "}
        <Link href="/tasks" className="font-semibold text-ink underline">
          Find an open one
        </Link>
        .
      </p>
    </div>
  );
}

function Timeline({ task }: { task: Task }) {
  const rows: [string, string | null][] = [
    [`Posted by ${task.poster_name}`, task.created_at],
    [`Accepted by ${task.assignee_name ?? "a freelancer"}`, task.accepted_at],
    ["Payment requested", task.invoiced_at],
    ["Paid and completed", task.completed_at],
  ];
  return (
    <ol className="mt-3 border-l-2 border-line pl-5">
      {rows.map(([label, at]) => (
        <li
          key={label}
          className={`relative pb-4 last:pb-0 ${at ? "" : "text-ink-soft/60"}`}
        >
          <span
            className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 ${
              at ? "border-plum bg-plum" : "border-line bg-mist"
            }`}
            aria-hidden
          />
          <span className="font-semibold">{label}</span>
          {at && (
            <span className="block text-sm text-ink-soft">
              {formatDateTime(at)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="font-semibold underline"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}
