"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { listProfiles, listTasks, subscribe as subscribeDb } from "./store";
import type { Profile, Task } from "./types";

interface LiveState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function liveQuery<T>(load: () => Promise<T>, initial: T) {
  const serverState: LiveState<T> = {
    data: initial,
    loading: true,
    error: null,
  };
  let state = serverState;
  const listeners = new Set<() => void>();
  let stop: (() => void) | null = null;

  const emit = () => listeners.forEach((l) => l());
  const refresh = () =>
    load()
      .then((data) => {
        state = { data, loading: false, error: null };
        emit();
      })
      .catch((e: Error) => {
        state = { ...state, loading: false, error: e.message };
        emit();
      });

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        refresh();
        try {
          stop = subscribeDb(refresh);
        } catch {
          stop = null; // not configured: the app shows a setup notice instead
        }
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = null;
        }
      };
    },
    get: () => state,
    getServer: () => serverState,
  };
}

const tasksQuery = liveQuery<Task[]>(listTasks, []);
const profilesQuery = liveQuery<Profile[]>(listProfiles, []);

export function useTasks() {
  return useSyncExternalStore(
    tasksQuery.subscribe,
    tasksQuery.get,
    tasksQuery.getServer,
  );
}

export function useTask(id: string) {
  const { data, loading, error } = useTasks();
  const task = useMemo(() => data.find((t) => t.id === id) ?? null, [data, id]);
  return { data: task, loading, error };
}

export function useProfiles() {
  return useSyncExternalStore(
    profilesQuery.subscribe,
    profilesQuery.get,
    profilesQuery.getServer,
  );
}

// ---------- time, read only in the browser so pages can be prerendered ----------

let clock = 0;
const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!clockTimer) {
    clock = Date.now();
    clockTimer = setInterval(() => {
      clock = Date.now();
      clockListeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/** Current time in ms, ticking every second. 0 during prerender. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => clock,
    () => 0,
  );
}

/** Today's date as YYYY-MM-DD in the person's own timezone, or "" during prerender. */
export function useToday(): string {
  const now = useNow();
  if (!now) return "";
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- naira estimate ----------

let priceCache: { at: number; ngnPerSat: number } | null = null;

export function useNairaPerSat(): number | null {
  const [rate, setRate] = useState<number | null>(
    priceCache?.ngnPerSat ?? null,
  );
  useEffect(() => {
    if (priceCache && Date.now() - priceCache.at < 600_000) return;
    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn",
    )
      .then((r) => r.json())
      .then((j) => {
        const ngn = j?.bitcoin?.ngn;
        if (typeof ngn === "number") {
          priceCache = { at: Date.now(), ngnPerSat: ngn / 100_000_000 };
          setRate(priceCache.ngnPerSat);
        }
      })
      .catch(() => {});
  }, []);
  return rate;
}
