"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelBet } from "@/lib/actions/bets";
import { Button } from "@/components/ui/button";

export function CancelBetButton({ betId }: { betId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        await cancelBet(betId);
        toast.success("Bet cancelled.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not cancel");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      className="self-end transition-transform active:scale-95"
    >
      {isPending ? "Cancelling..." : "Cancel bet"}
    </Button>
  );
}
