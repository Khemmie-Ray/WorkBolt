export function formatSats(n: number): string {
  return new Intl.NumberFormat("en-NG").format(n);
}

export function formatNaira(n: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function deadlineText(deadline: string): {
  text: string;
  urgent: boolean;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return { text: "Due today", urgent: true };
  if (days === 1) return { text: "Due tomorrow", urgent: true };
  if (days > 1) return { text: `Due in ${days} days`, urgent: days <= 2 };
  return {
    text: `${Math.abs(days)} day${days === -1 ? "" : "s"} past due`,
    urgent: true,
  };
}

export function shortAddress(a: string): string {
  return a.length > 18 ? `${a.slice(0, 10)}…${a.slice(-6)}` : a;
}
