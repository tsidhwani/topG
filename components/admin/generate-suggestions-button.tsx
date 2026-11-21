"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateSuggestions } from "@/lib/actions/suggestions";
import { Button } from "@/components/ui/button";

export function GenerateSuggestionsButton({
  season,
  week,
}: {
  season: number;
  week: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const count = await generateSuggestions(season, week);
        if (count === 0) {
          toast.error("No synced projections for this week yet — sync ESPN first.");
        } else {
          toast.success(`Generated ${count} suggestion${count === 1 ? "" : "s"}.`);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Button type="button" onClick={handleClick} disabled={isPending}>
      {isPending ? "Generating..." : "Generate suggestions"}
    </Button>
  );
}
