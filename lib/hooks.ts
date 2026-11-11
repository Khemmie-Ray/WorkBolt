"use client";

import { useCallback, useEffect, useState } from "react";
import { getTask, listProfiles, listTasks, subscribe } from "./store";
import type { Profile, Task } from "./types";

function useLive<T>(load: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    load()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useTasks() {
  return useLive<Task[]>(listTasks, []);
}

export function useTask(id: string) {
  const load = useCallback(() => getTask(id), [id]);
  return useLive<Task | null>(load, null);
}

export function useProfiles() {
  return useLive<Profile[]>(listProfiles, []);
}

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
