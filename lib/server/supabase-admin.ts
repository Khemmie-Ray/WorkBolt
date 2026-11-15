import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Task } from "@/lib/types";

let client: SupabaseClient | null = null;

export function adminConfigured() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY
  );
}

export function admin(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key)
      throw new Error("The server is missing SUPABASE_SECRET_KEY.");
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/** The signed-in user behind a request (from its Bearer token), or null. */
export async function callerId(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export async function loadTask(id: string): Promise<Task | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await admin()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Task | null;
}

export async function patchTask(id: string, patch: Partial<Task>) {
  const { error } = await admin().from("tasks").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Throws 401/403 unless the caller is signed in (and, if given, is `allowed`). */
export async function requireCaller(
  req: Request,
  allowed?: string | null,
  who = "the right person",
): Promise<string> {
  const id = await callerId(req);
  if (!id) throw new HttpError(401, "Sign in first.");
  if (allowed !== undefined && id !== allowed)
    throw new HttpError(403, `Only ${who} can do that.`);
  return id;
}
