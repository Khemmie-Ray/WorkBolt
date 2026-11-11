"use client";

import { supabase } from "./supabase";
import type { NewTask, Profile, Task } from "./types";
import type { EscrowView } from "./escrow";

/*
 * One data API, two backends:
 * - Supabase when NEXT_PUBLIC_SUPABASE_URL / ANON_KEY are set
 * - localStorage otherwise (demo mode, syncs across tabs in the same browser)
 */

const LS_TASKS = "sfs.tasks";
const LS_PROFILES = "sfs.profiles";
const CHANGE = "sfs:change";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const daysFromNow = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString().slice(0, 10);
};

// ---------- local demo backend ----------

function seed(): { tasks: Task[]; profiles: Profile[] } {
  const ada: Profile = {
    id: "demo-adaeze",
    name: "Adaeze",
    lightning_address: null,
    skills: "Runs a small skincare brand in Yaba",
    trezor_address: null,
    trezor_message: null,
    trezor_signature: null,
    created_at: now(),
  };
  const tolu: Profile = {
    id: "demo-tolu",
    name: "Tolu",
    lightning_address: null,
    skills: "Yoruba and French translation, copywriting",
    trezor_address: null,
    trezor_message: null,
    trezor_signature: null,
    created_at: now(),
  };
  const base = {
    contact: "Telegram @adaeze_glow",
    poster_id: ada.id,
    poster_name: ada.name,
    assignee_id: null,
    assignee_name: null,
    invoice: null,
    delivery_note: null,
    preimage: null,
    accepted_at: null,
    invoiced_at: null,
    completed_at: null,
    bond_sats: null,
    bond_status: null,
    bond_invoice: null,
  };
  const tasks: Task[] = [
    {
      ...base,
      id: uid(),
      title: "Translate my product labels into Yoruba",
      description:
        "Six short product labels (about 120 words in total) for my shea butter line. I need natural Yoruba that a market buyer in Ibadan would read easily, not word-for-word.",
      category: "translation",
      budget_sats: 2000,
      deadline: daysFromNow(3),
      status: "open",
      created_at: now(),
    },
    {
      ...base,
      id: uid(),
      title: "Instagram carousel for a Bitcoin savings class",
      description:
        "Five slides explaining what a Lightning wallet is, for women who have never used Bitcoin. I will send the text. You handle layout and colours.",
      category: "design",
      budget_sats: 8500,
      deadline: daysFromNow(6),
      status: "open",
      contact: "WhatsApp +234 801 000 0000",
      created_at: now(),
    },
    {
      ...base,
      id: uid(),
      title: "Two maths lessons for a JSS2 student",
      description:
        "Fractions and simple equations, one hour each, over Google Meet. Patient tutors only, she gets nervous.",
      category: "tutoring",
      budget_sats: 6000,
      deadline: daysFromNow(9),
      status: "open",
      contact: "Email mum.of.two@example.com",
      created_at: now(),
    },
    {
      ...base,
      id: uid(),
      title: "500-word blog post: why I price my cakes in sats",
      description:
        "Friendly first-person voice. I will share notes from a voice memo.",
      category: "writing",
      budget_sats: 4000,
      deadline: daysFromNow(1),
      status: "in_progress",
      assignee_id: tolu.id,
      assignee_name: tolu.name,
      accepted_at: now(),
      created_at: now(),
    },
  ];
  return { tasks, profiles: [ada, tolu] };
}

function readLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(key);
  if (raw === null) {
    const s = seed();
    localStorage.setItem(LS_TASKS, JSON.stringify(s.tasks));
    localStorage.setItem(LS_PROFILES, JSON.stringify(s.profiles));
    return (key === LS_TASKS ? s.tasks : s.profiles) as T[];
  }
  return JSON.parse(raw) as T[];
}

function writeLocal<T>(key: string, rows: T[]) {
  localStorage.setItem(key, JSON.stringify(rows));
  window.dispatchEvent(new Event(CHANGE));
}

function patchLocalTask(id: string, patch: Partial<Task>): Task {
  const rows = readLocal<Task>(LS_TASKS);
  const i = rows.findIndex((t) => t.id === id);
  if (i < 0) throw new Error("Task not found.");
  rows[i] = { ...rows[i], ...patch };
  writeLocal(LS_TASKS, rows);
  return rows[i];
}

// ---------- shared helpers ----------

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function patchTask(
  id: string,
  patch: Partial<Task>,
  expect?: Task["status"],
): Promise<Task> {
  if (!supabase) {
    if (expect) {
      const cur = readLocal<Task>(LS_TASKS).find((t) => t.id === id);
      if (cur?.status !== expect)
        throw new Error("This task changed. Refresh and try again.");
    }
    return patchLocalTask(id, patch);
  }
  let q = supabase.from("tasks").update(patch).eq("id", id);
  if (expect) q = q.eq("status", expect); // guards against two people accepting at once
  const { data, error } = await q.select().single();
  fail(error);
  if (!data) throw new Error("This task changed. Refresh and try again.");
  return data as Task;
}

// ---------- tasks ----------

export async function listTasks(): Promise<Task[]> {
  if (!supabase) {
    return readLocal<Task>(LS_TASKS).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []) as Task[];
}

export async function getTask(id: string): Promise<Task | null> {
  if (!supabase)
    return readLocal<Task>(LS_TASKS).find((t) => t.id === id) ?? null;
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data as Task | null;
}

export async function createTask(
  input: NewTask,
  poster: Profile,
  bondStatus: Task["bond_status"] = "none",
): Promise<Task> {
  const task: Task = {
    ...input,
    id: uid(),
    status: "open",
    poster_id: poster.id,
    poster_name: poster.name,
    assignee_id: null,
    assignee_name: null,
    invoice: null,
    delivery_note: null,
    preimage: null,
    created_at: now(),
    accepted_at: null,
    invoiced_at: null,
    completed_at: null,
    bond_sats: null,
    bond_status: bondStatus,
    bond_invoice: null,
  };
  if (!supabase) {
    writeLocal(LS_TASKS, [task, ...readLocal<Task>(LS_TASKS)]);
    return task;
  }
  const { data, error } = await supabase
    .from("tasks")
    .insert(task)
    .select()
    .single();
  fail(error);
  return data as Task;
}

export function acceptTask(id: string, freelancer: Profile) {
  return patchTask(
    id,
    {
      status: "in_progress",
      assignee_id: freelancer.id,
      assignee_name: freelancer.name,
      accepted_at: now(),
    },
    "open",
  );
}

export function sendInvoice(id: string, invoice: string, deliveryNote: string) {
  return patchTask(
    id,
    { invoice, delivery_note: deliveryNote || null, invoiced_at: now() },
    "in_progress",
  );
}

export function completeTask(id: string, preimage: string | null) {
  return patchTask(
    id,
    { status: "completed", preimage, completed_at: now() },
    "in_progress",
  );
}

export function releaseTask(id: string) {
  return patchTask(
    id,
    {
      status: "open",
      assignee_id: null,
      assignee_name: null,
      accepted_at: null,
      invoice: null,
      invoiced_at: null,
      delivery_note: null,
    },
    "in_progress",
  );
}

/**
 * Copy the server's bond state onto the task. With Supabase the server already
 * wrote it, so this only matters in local demo mode.
 */
export function applyEscrow(view: EscrowView, extra: Partial<Task> = {}) {
  if (supabase) return;
  patchLocalTask(view.task_id, {
    bond_sats: view.bond_sats,
    bond_status: view.status,
    bond_invoice: view.invoice,
    ...extra,
  });
}

// ---------- profiles ----------

export async function listProfiles(): Promise<Profile[]> {
  if (!supabase) return readLocal<Profile>(LS_PROFILES);
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");
  fail(error);
  return (data ?? []) as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!supabase)
    return readLocal<Profile>(LS_PROFILES).find((p) => p.id === id) ?? null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data as Profile | null;
}

export async function createProfile(
  name: string,
  lightning_address: string | null,
): Promise<Profile> {
  const p: Profile = {
    id: uid(),
    name,
    lightning_address,
    skills: null,
    trezor_address: null,
    trezor_message: null,
    trezor_signature: null,
    created_at: now(),
  };
  if (!supabase) {
    writeLocal(LS_PROFILES, [...readLocal<Profile>(LS_PROFILES), p]);
    return p;
  }
  const { data, error } = await supabase
    .from("profiles")
    .insert(p)
    .select()
    .single();
  fail(error);
  return data as Profile;
}

export async function updateProfile(
  id: string,
  patch: Partial<Profile>,
): Promise<Profile> {
  if (!supabase) {
    const rows = readLocal<Profile>(LS_PROFILES);
    const i = rows.findIndex((p) => p.id === id);
    rows[i] = { ...rows[i], ...patch };
    writeLocal(LS_PROFILES, rows);
    return rows[i];
  }
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  fail(error);
  return data as Profile;
}

// ---------- change subscription ----------

export function subscribe(onChange: () => void): () => void {
  if (!supabase) {
    const storage = (e: StorageEvent) => {
      if (e.key === LS_TASKS || e.key === LS_PROFILES) onChange();
    };
    window.addEventListener(CHANGE, onChange);
    window.addEventListener("storage", storage); // other tabs
    return () => {
      window.removeEventListener(CHANGE, onChange);
      window.removeEventListener("storage", storage);
    };
  }
  const channel = supabase
    .channel(`sfs-${uid()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "profiles" },
      onChange,
    )
    .subscribe();
  return () => {
    supabase!.removeChannel(channel);
  };
}

export function resetDemo() {
  localStorage.removeItem(LS_TASKS);
  localStorage.removeItem(LS_PROFILES);
  window.dispatchEvent(new Event(CHANGE));
}
