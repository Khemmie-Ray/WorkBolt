"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMe } from "@/components/Identity";
import { TicketCard } from "@/components/Ticket";
import { EscrowSync } from "@/components/Bond";
import { useTasks } from "@/lib/hooks";
import { isListed } from "@/lib/escrow";
import { formatSats } from "@/lib/format";
import type { Task } from "@/lib/types";

const HERO_PHOTO =
  "https://images.pexels.com/photos/1181317/pexels-photo-1181317.jpeg?auto=compress&cs=tinysrgb&w=1200";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { me, ready } = useMe();
  const { data: tasks, loading } = useTasks();

  const fresh = useMemo(
    () =>
      tasks
        .filter(
          (t) => t.status === "open" && isListed(t) && t.poster_id !== me?.id,
        )
        .slice(0, 4),
    [tasks, me],
  );

  if (!ready) return null;

  return (
    <div className="space-y-10">
      {me ? (
        <Dashboard tasks={tasks} meId={me.id} name={me.name} />
      ) : (
        <Landing />
      )}
      {me &&
        tasks
          .filter((t) => t.poster_id === me.id && t.bond_status === "awaiting")
          .map((t) => <EscrowSync key={t.id} taskId={t.id} />)}
      <OpenTasks tasks={fresh} loading={loading} />
    </div>
  );
}

// ---------- signed out ----------

const STEPS = [
  ["Post it", "Say what you need, your price in sats and when you need it by."],
  [
    "Someone takes it",
    "A freelancer with the skill accepts. They can message you first.",
  ],
  [
    "Work plus invoice",
    "They deliver and attach a Lightning invoice. We check it matches your price.",
  ],
  [
    "Pay and close",
    "Scan or tap to pay from your own wallet. The ticket is stamped paid.",
  ],
];

function Landing() {
  const { askToJoin } = useMe();
  return (
    <>
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div>
          <h1 className="mt-6 font-display text-[3.4rem] font-extrabold leading-[0.95] tracking-[-0.03em] sm:text-[4.75rem] lg:text-[5.5rem]">
            Skills in.
            <br />
            Sats out.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-ink-soft">
            Post a small job with a price in sats. Someone who can do it picks
            it up, delivers, and sends a Lightning invoice. You pay from your
            own wallet in seconds.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/tasks/new" className="btn-gold">
              Post a task
            </Link>
            <Link href="/tasks" className="btn-primary">
              Find work
            </Link>
            <button
              onClick={askToJoin}
              className="px-2 font-display font-semibold text-ink-soft underline decoration-line decoration-2 underline-offset-4 hover:text-ink"
            >
              Join with a name
            </button>
          </div>
        </div>

        <figure className="relative">
          <div className="relative aspect-[4/3] max-h-[560px] w-full overflow-hidden rounded-[28px] bg-plum-2 sm:aspect-[5/4] lg:aspect-[4/5]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_PHOTO}
              alt="A woman working on a laptop"
              className="hero-drift absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-plum/60 via-transparent to-transparent" />
          </div>

          {/* A real ticket from the board, sitting on the photo */}
          <div className="ticket-float absolute -bottom-5 left-4 right-4 flex overflow-hidden rounded-2xl bg-paper shadow-[0_24px_48px_-20px_rgb(36_22_58/0.55)] sm:left-auto sm:right-[-12px] sm:w-[330px] lg:right-auto lg:left-[-36px]">
            <div className="flex-1 p-4">
              <p className="text-xs font-semibold text-ink-soft">Translation</p>
              <p className="mt-1 font-display font-bold leading-snug">
                Product labels into Yoruba
              </p>
              <p className="mt-1.5 text-xs text-ink-soft">
                Tolu delivered in 2 days
              </p>
            </div>
            <div className="perf" />
            <div className="relative grid w-[108px] place-items-center bg-teal-wash px-2 text-center">
              <div>
                <p className="font-display text-2xl font-extrabold leading-none text-plum">
                  2,000
                </p>
                <p className="font-display text-xs font-semibold text-plum">
                  sats
                </p>
              </div>
              <span
                className="stamp-in absolute right-1.5 top-1.5 rounded border-2 border-teal px-1 font-display text-[11px] font-extrabold text-teal"
                style={{ transform: "rotate(-8deg)" }}
              >
                Paid
              </span>
            </div>
          </div>
        </figure>
      </section>

      <section
        aria-labelledby="how"
        className="rounded-[24px] bg-plum p-6 text-paper sm:p-8"
      >
        <h2 id="how" className="font-display text-lg font-bold">
          How a task moves
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-0">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-3 lg:block lg:pr-6">
              <div className="flex items-center">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold font-display text-sm font-extrabold text-plum">
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className="ml-3 hidden h-px flex-1 bg-[#4a3868] lg:block"
                    aria-hidden
                  />
                )}
              </div>
              <div>
                <p className="font-display font-bold lg:mt-3">{title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-[#cfc6e0] lg:mt-1">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

// ---------- signed in ----------

function Dashboard({
  tasks,
  meId,
  name,
}: {
  tasks: Task[];
  meId: string;
  name: string;
}) {
  const view = useMemo(() => {
    const mine = (t: Task) => t.poster_id === meId;
    const doing = (t: Task) => t.assignee_id === meId;
    const earned = tasks.filter((t) => doing(t) && t.status === "completed");
    const paid = tasks.filter((t) => mine(t) && t.status === "completed");
    const actions: { task: Task; text: string; tone: "gold" | "iris" }[] = [];
    for (const t of tasks) {
      if (doing(t) && t.status === "in_progress")
        actions.push({
          task: t,
          text: t.invoice
            ? `Waiting for ${t.poster_name} to pay`
            : `Deliver and send your invoice for ${formatSats(t.budget_sats)} sats`,
          tone: "iris",
        });
      if (mine(t) && t.status === "in_progress")
        actions.push(
          t.invoice
            ? {
                task: t,
                text: `${t.assignee_name} sent an invoice. Pay ${formatSats(t.budget_sats)} sats`,
                tone: "gold",
              }
            : {
                task: t,
                text: `${t.assignee_name} is working on it`,
                tone: "iris",
              },
        );
      if (mine(t) && t.status === "open")
        actions.push({
          task: t,
          text: isListed(t)
            ? "Waiting for someone to accept"
            : "Lock your commitment to list it",
          tone: "gold",
        });
    }
    return {
      earned: earned.reduce((s, t) => s + t.budget_sats, 0),
      earnedCount: earned.length,
      paid: paid.reduce((s, t) => s + t.budget_sats, 0),
      paidCount: paid.length,
      actions,
    };
  }, [tasks, meId]);

  return (
    <>
      <header>
        <p className="font-display text-lg text-ink-soft">
          {greeting()}, {name}
        </p>
        <h1 className="mt-1 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-[-0.02em] sm:text-[2.75rem] sm:leading-[1.08]">
          <Ledger {...view} />
        </h1>
      </header>

      {view.actions.length > 0 && (
        <section aria-labelledby="needs">
          <h2 id="needs" className="font-display text-xl font-bold">
            Your tasks right now
          </h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[18px] bg-paper shadow-ticket">
            {view.actions.map(({ task, text, tone }) => (
              <li key={task.id + text}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex flex-col gap-1 px-5 py-3.5 hover:bg-mist/60 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span
                    className={`hidden h-8 w-1.5 shrink-0 rounded-full sm:block ${tone === "gold" ? "bg-gold" : "bg-iris"}`}
                    aria-hidden
                  />
                  <span className="flex-1 font-display font-semibold">
                    {task.title}
                  </span>
                  <span className="text-ink-soft">{text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Ledger(p: {
  earned: number;
  earnedCount: number;
  paid: number;
  paidCount: number;
}) {
  const tasks = (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`;
  if (!p.earnedCount && !p.paidCount)
    return <>No sats have moved yet. Pick up a task or post one.</>;
  if (!p.paidCount)
    return (
      <>
        You have earned <Sats n={p.earned} /> from {tasks(p.earnedCount)}.
      </>
    );
  if (!p.earnedCount)
    return (
      <>
        You have paid <Sats n={p.paid} /> for {tasks(p.paidCount)}.
      </>
    );
  return (
    <>
      You have earned <Sats n={p.earned} /> from {tasks(p.earnedCount)} and paid{" "}
      <Sats n={p.paid} /> for {p.paidCount}.
    </>
  );
}

function Sats({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap rounded-lg bg-gold px-2 py-0.5 text-plum [box-decoration-break:clone]">
      {formatSats(n)} sats
    </span>
  );
}

// ---------- shared ----------

function OpenTasks({ tasks, loading }: { tasks: Task[]; loading: boolean }) {
  return (
    <section aria-labelledby="fresh">
      <div className="flex items-end justify-between gap-4">
        <h2 id="fresh" className="font-display text-xl font-bold">
          Open on the board
        </h2>
        {tasks.length > 0 && (
          <Link
            href="/tasks"
            className="font-display font-semibold underline decoration-gold decoration-2 underline-offset-4"
          >
            See all tasks
          </Link>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-ink-soft">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="mt-3 flex flex-col gap-4 rounded-[18px] border-2 border-dashed border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold">
              The board is quiet.
            </p>
            <p className="text-ink-soft">
              Post the first job. It takes about a minute.
            </p>
          </div>
          <Link href="/tasks/new" className="btn-primary shrink-0">
            Post a task
          </Link>
        </div>
      ) : (
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          {tasks.map((t) => (
            <TicketCard key={t.id} task={t} />
          ))}
        </div>
      )}
    </section>
  );
}
