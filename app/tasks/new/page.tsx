"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMe } from "@/components/Identity";
import { createTask } from "@/lib/store";
import { CATEGORIES, type Category } from "@/lib/types";
import { formatNaira, formatSats } from "@/lib/format";
import { useNairaPerSat, useToday } from "@/lib/hooks";
import { escrowAction, useEscrowConfig } from "@/lib/escrow-client";
import { bondFor } from "@/lib/escrow";

const PRESETS = [1000, 2000, 5000, 10000];

export default function PostTask() {
  const router = useRouter();
  const { me, askToJoin } = useMe();
  const rate = useNairaPerSat();
  const escrow = useEscrowConfig();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("translation");
  const [budget, setBudget] = useState("2000");
  const today = useToday(); // read in the browser only, so the page can be prerendered
  const [pickedDeadline, setDeadline] = useState("");
  const deadline = pickedDeadline || addDays(today, 3);
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sats = Number(budget.replace(/[^\d]/g, "")) || 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me) return askToJoin();
    if (!escrow) return setError("Still loading. Try again in a second.");
    if (title.trim().length < 6)
      return setError("Give the task a title of at least a few words.");
    if (description.trim().length < 20)
      return setError(
        "Describe the job so a freelancer knows what to deliver.",
      );
    if (sats < 100) return setError("Set a price of at least 100 sats.");
    if (!deadline || deadline < today)
      return setError("Pick a deadline from today onwards.");
    if (!contact.trim())
      return setError(
        "Add how freelancers can reach you, for example a Telegram handle.",
      );
    setBusy(true);
    try {
      const t = await createTask(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          budget_sats: sats,
          deadline,
          contact: contact.trim(),
        },
        escrow.enabled,
      );
      if (escrow.enabled) {
        // Create the commitment invoice now; if this fails the task page offers a retry
        await escrowAction(t.id, "create").catch(() => null);
      }
      router.push(`/tasks/${t.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        Post a task
      </h1>
      <p className="mt-2 text-ink-soft">
        Say what you need, what you will pay in sats and by when. Freelancers
        will contact you before they accept.
      </p>

      <form
        onSubmit={submit}
        className="mt-8 space-y-6 rounded-[20px] bg-paper p-5 shadow-ticket sm:p-8"
        noValidate
      >
        <label className="field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Translate a flyer into Hausa"
            maxLength={90}
          />
        </label>

        <fieldset>
          <legend className="font-display text-sm font-semibold">
            Skill needed
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <label
                key={c.value}
                className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold ${
                  category === c.value
                    ? "border-plum bg-plum text-paper"
                    : "border-line text-ink-soft hover:border-ink-soft"
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                  className="sr-only"
                />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>What needs doing</span>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What you will send, what you expect back, and anything the freelancer should know."
          />
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="field">
            <label
              htmlFor="budget"
              className="font-display text-sm font-semibold"
            >
              Price in sats
            </label>
            <input
              id="budget"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <div className="mt-1 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setBudget(String(p))}
                  className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${
                    sats === p
                      ? "bg-gold text-plum"
                      : "bg-mist text-ink-soft hover:text-ink"
                  }`}
                >
                  {formatSats(p)}
                </button>
              ))}
            </div>
            <small>
              {rate && sats > 0
                ? `About ${formatNaira(sats * rate)} at today's rate.`
                : "1 bitcoin is 100,000,000 sats."}
            </small>
            {escrow?.enabled && sats >= 100 && (
              <small className="text-ink">
                To list it, you&apos;ll lock {formatSats(bondFor(sats))} sats (
                {escrow.percent}%). You get them back when you pay for the work.
              </small>
            )}
          </div>
          <label className="field">
            <span>Deadline</span>
            <input
              type="date"
              min={today}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>How to reach you</span>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Telegram @yourname, or an email"
          />
          <small>
            Shown on the task so freelancers can ask questions before accepting.
          </small>
        </label>

        {error && (
          <p className="text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy
              ? "Posting…"
              : !me
                ? "Join to post this task"
                : escrow?.enabled
                  ? "Post and lock commitment"
                  : `Post task for ${formatSats(sats)} sats`}
          </button>
        </div>
      </form>
    </div>
  );
}

/** YYYY-MM-DD plus n days, or "" if there is no date yet. */
function addDays(ymd: string, n: number) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  const out = new Date(y, m - 1, d + n);
  return `${out.getFullYear()}-${String(out.getMonth() + 1).padStart(2, "0")}-${String(out.getDate()).padStart(2, "0")}`;
}
