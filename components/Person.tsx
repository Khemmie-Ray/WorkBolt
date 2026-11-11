"use client";

import { ShieldCheck } from "lucide-react";
import { useProfiles } from "@/lib/hooks";

export function Person({
  id,
  name,
}: {
  id: string | null;
  name: string | null;
}) {
  const { data: profiles } = useProfiles();
  const verified = !!profiles.find((p) => p.id === id)?.trezor_address;
  return (
    <strong className="inline-flex items-center gap-1 text-ink">
      {name}
      {verified && (
        <span title="Verified with Trezor" className="inline-flex text-teal">
          <ShieldCheck size={16} aria-label="Verified with Trezor" />
        </span>
      )}
    </strong>
  );
}
