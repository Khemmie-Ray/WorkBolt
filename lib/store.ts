"use client";

import { db } from "./supabase";
import type { NewTask, Profile, ProfilePatch, Task } from "./types";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const localListeners = new Set<() => void>();
export const notifyChanged = () => localListeners.forEach((l) => l());

async function rpc(fn: string, args: Record<string, unknown>): Promise<Task> {
  const { data, error } = await db().rpc(fn, args);
  fail(error);
  notifyChanged();
  return data as Task;
}

// ---------- tasks ----------

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await db()
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });
  fail(error);
  return (data ?? []) as Task[];
}

export async function getTask(id: string): Promise<Task | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data as Task | null;
}

export function createTask(input: NewTask, withBond: boolean) {
  return rpc("create_task", {
    p_title: input.title,
    p_description: input.description,
    p_category: input.category,
    p_budget_sats: input.budget_sats,
    p_deadline: input.deadline,
    p_contact: input.contact,
    p_with_bond: withBond,
  });
}

export const acceptTask = (id: string) => rpc("accept_task", { p_task: id });

export const releaseTask = (id: string) => rpc("release_task", { p_task: id });

export const sendInvoice = (id: string, invoice: string, note: string) =>
  rpc("send_invoice", { p_task: id, p_invoice: invoice, p_note: note });

export const requestFlashPayment = (id: string, note: string) =>
  rpc("request_flash_payment", { p_task: id, p_note: note });

export const completeTask = (id: string, preimage: string | null) =>
  rpc("complete_task", { p_task: id, p_preimage: preimage });

// ---------- profiles ----------

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .order("created_at");
  fail(error);
  return (data ?? []) as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  fail(error);
  return data as Profile | null;
}

/** Row-level security only lets people update their own row. */
export async function updateMyProfile(
  id: string,
  patch: ProfilePatch,
): Promise<Profile> {
  const { data, error } = await db()
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  fail(error);
  notifyChanged();
  return data as Profile;
}

// ---------- live updates ----------

let channelSeq = 0;

export function subscribe(onChange: () => void): () => void {
  localListeners.add(onChange);
  const client = db();
  const channel = client
    .channel(`workbolt-${++channelSeq}-${Math.random().toString(36).slice(2)}`)
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
    localListeners.delete(onChange);
    client.removeChannel(channel);
  };
}
