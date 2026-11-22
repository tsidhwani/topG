"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "cn";

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
  const [remainingMs, setRemainingMs] = useState(() => target - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setRemainingMs(target - Date.now());
    }, 30_000);
    return () => clearInterval(id);
  }, [target]);

  const label = formatRemaining(remainingMs);
  const locked = remainingMs <= 0;
  const urgent = !locked && remainingMs < 60 * 60_000;

  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs transition-colors",
        locked && "text-destructive",
        urgent && "animate-pulse text-destructive",
        !locked && !urgent && "text-muted-foreground",
      )}
    >
      <Clock className="size-3" />
      {label}
    </span>
  );
}
