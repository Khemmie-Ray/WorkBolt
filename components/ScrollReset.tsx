"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ScrollReset({ targetId }: { targetId: string }) {
  const path = usePathname();
  useEffect(() => {
    document.getElementById(targetId)?.scrollTo({ top: 0 });
  }, [path, targetId]);
  return null;
}
