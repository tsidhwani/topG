"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { syncEspnNow } from "@/lib/actions/espn";
import { Button } from "@/components/ui/button";

export function SyncNowButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const summary = await syncEspnNow();
        toast.success(
          `Synced ${summary.teams} teams, ${summary.matchups} matchups, ` +
            `${summary.playerWeeksSynced} player-weeks (weeks ${summary.weeksSynced.join(", ")}). ` +
            `Auto-graded ${summary.marketsAutoGraded} market${summary.marketsAutoGraded === 1 ? "" : "s"}, ` +
            `regraded ${summary.betsRegraded} bet${summary.betsRegraded === 1 ? "" : "s"}.`,
          { duration: 8000 },
        );
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sync failed");
      }
    });
  }

  return (
    <Button type="button" onClick={handleClick} disabled={isPending}>
      {isPending ? "Syncing..." : "Sync now"}
    </Button>
  );
}
