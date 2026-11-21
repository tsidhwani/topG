"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateTeamExtremes } from "@/lib/actions/team-extremes";
import { DEFAULT_VIG } from "@/lib/suggestions/simulate";
import { TeamExtremesRow, type TeamExtremesDraftRow } from "./team-extremes-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TeamExtremesStudio({
  season,
  week,
  rows,
}: {
  season: number;
  week: number;
  rows: TeamExtremesDraftRow[];
}) {
  const router = useRouter();
  const [vig, setVig] = useState(String(DEFAULT_VIG));
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      try {
        const count = await generateTeamExtremes(season, week, Number(vig) || DEFAULT_VIG);
        if (count === 0) {
          toast.error("No synced projections for this week yet — sync ESPN first.");
        } else {
          toast.success("Generated Highest and Lowest Scoring Team markets.");
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="team-extremes-vig" className="text-xs">
            Overround
          </Label>
          <Input
            id="team-extremes-vig"
            type="number"
            step="0.005"
            value={vig}
            onChange={(e) => setVig(e.target.value)}
            className="w-28"
          />
        </div>
        <Button type="button" onClick={handleGenerate} disabled={isPending}>
          {isPending ? "Generating..." : `Generate for week ${week}`}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No high/low scorer markets yet for week {week}. Generate them above
          once ESPN projections are synced.
        </p>
      ) : (
        rows.map((row) => <TeamExtremesRow key={row.marketId} row={row} />)
      )}
    </div>
  );
}
