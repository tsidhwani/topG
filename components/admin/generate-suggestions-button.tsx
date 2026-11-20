"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const count = await generateSuggestions(season, week);
        setMessage(
          count === 0
            ? "No matchups with synced projections for this week yet — sync ESPN first."
            : `Generated ${count} suggestion${count === 1 ? "" : "s"}.`,
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={handleClick} disabled={isPending}>
        {isPending ? "Generating..." : "Generate suggestions"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
