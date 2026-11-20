"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBet } from "@/lib/actions/bets";
import { Button } from "@/components/ui/button";

export function CancelBetButton({ betId }: { betId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        await cancelBet(betId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not cancel");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? "Cancelling..." : "Cancel bet"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
