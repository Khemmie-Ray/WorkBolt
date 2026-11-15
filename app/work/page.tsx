"use client";

import Link from "next/link";
import { useMe } from "@/components/Identity";
import { TicketCard } from "@/components/Ticket";
import { useTasks } from "@/lib/hooks";
import type { Task } from "@/lib/types";

const ORDER: Record<Task["status"], number> = {
  in_progress: 0,
  open: 1,
  completed: 2,
};

export default function MyWork() {
  const { me, ready, askToJoin } = useMe();
  const { data: tasks } = useTasks();

  if (!ready) return null;
  if (!me)
    return (
      <div className="max-w-xl">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">My work</h1>
        <p className="mt-2 text-ink-soft">
          Sign in to see the tasks you post and the ones you take on.
        </p>
        <button onClick={askToJoin} className="btn-primary mt-6">
          Join with Google
        </button>
      </div>
    );

  const sort = (a: Task, b: Task) => ORDER[a.status] - ORDER[b.status];
  const doing = tasks.filter((t) => t.assignee_id === me.id).sort(sort);
  const posted = tasks.filter((t) => t.poster_id === me.id).sort(sort);

  return (
    <div className="space-y-12">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">My work</h1>

      <Group
        title="Tasks I'm doing"
        tasks={doing}
        empty={
          <>
            You haven&apos;t accepted any tasks.{" "}
            <Link href="/tasks" className="font-semibold text-ink underline">
              Browse open tasks
            </Link>
            .
          </>
        }
      />
      <Group
        title="Tasks I posted"
        tasks={posted}
        empty={
          <>
            You haven&apos;t posted anything.{" "}
            <Link
              href="/tasks/new"
              className="font-semibold text-ink underline"
            >
              Post a task
            </Link>
            .
          </>
        }
      />
    </div>
  );
}

function Group({
  title,
  tasks,
  empty,
}: {
  title: string;
  tasks: Task[];
  empty: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold">
        {title} <span className="text-ink-soft">{tasks.length}</span>
      </h2>
      <div className="mt-4 grid gap-5 lg:grid-cols-2">
        {tasks.length === 0 ? (
          <p className="text-ink-soft">{empty}</p>
        ) : (
          tasks.map((t) => <TicketCard key={t.id} task={t} />)
        )}
      </div>
    </section>
  );
}
