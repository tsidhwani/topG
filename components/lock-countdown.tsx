"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Locked";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Locks in ${days}d ${hours}h`;
  if (hours > 0) return `Locks in ${hours}h ${minutes}m`;
  return `Locks in ${minutes}m`;
}

export function LockCountdown({ lockAt }: { lockAt: string }) {
  const target = new Date(lockAt).getTime();
  const [label, setLabel] = useState(() => formatRemaining(target - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      setLabel(formatRemaining(target - Date.now()));
    }, 30_000);
    return () => clearInterval(id);
  }, [target]);

  const locked = label === "Locked";

  return (
    <span
      className={
        locked
          ? "flex items-center gap-1 text-xs text-destructive"
          : "flex items-center gap-1 text-xs text-muted-foreground"
      }
    >
      <Clock className="size-3" />
      {label}
    </span>
  );
}
