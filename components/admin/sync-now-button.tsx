"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncEspnNow } from "@/lib/actions/espn";
import { Button } from "@/components/ui/button";

export function SyncNowButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const summary = await syncEspnNow();
        setMessage(
          `Synced ${summary.teams} teams, ${summary.matchups} matchups, ` +
            `${summary.playerWeeksSynced} player-weeks (weeks ${summary.weeksSynced.join(", ")}).`,
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? "Syncing..." : "Sync now"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
