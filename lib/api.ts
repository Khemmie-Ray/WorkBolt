"use client";

import { supabase } from "./supabase";

export async function api<T>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.error ?? "Workbolt's server did not respond. Try again.",
    );
  return data as T;
}
