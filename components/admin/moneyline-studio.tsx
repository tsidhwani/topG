"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  generateMoneylineSuggestions,
  publishMarkets,
} from "@/lib/actions/suggestions";
import { DEFAULT_VIG } from "@/lib/suggestions/simulate";
import { MoneylineRow, type MoneylineDraftRow } from "./moneyline-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MoneylineStudio({
  season,
  week,
  rows,
}: {
  season: number;
  week: number;
  rows: MoneylineDraftRow[];
}) {
  const router = useRouter();
  const [globalVig, setGlobalVig] = useState(String(DEFAULT_VIG));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleSelected(marketId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(marketId);
      else next.delete(marketId);
      return next;
    });
  }

  function handleGenerate() {
    startTransition(async () => {
      try {
        const count = await generateMoneylineSuggestions(
          season,
          week,
          Number(globalVig) || DEFAULT_VIG,
        );
        if (count === 0) {
          toast.error("No synced projections for this week yet — sync ESPN first.");
        } else {
          toast.success(`Generated ${count} moneyline${count === 1 ? "" : "s"}.`);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handlePublishSelected() {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error("Select at least one draft to publish.");
      return;
    }
    startTransition(async () => {
      try {
        await publishMarkets(ids);
        toast.success(`Published ${ids.length} line${ids.length === 1 ? "" : "s"}.`);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not publish");
      }
    });
  }

  const draftCount = rows.filter((r) => r.status === "draft").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="global-vig" className="text-xs">
            Global vig
          </Label>
          <Input
            id="global-vig"
            type="number"
            step="0.005"
            value={globalVig}
            onChange={(e) => setGlobalVig(e.target.value)}
            className="w-28"
          />
        </div>
        <Button type="button" onClick={handleGenerate} disabled={isPending}>
          {isPending ? "Generating..." : `Generate moneylines for week ${week}`}
        </Button>
        {draftCount > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={handlePublishSelected}
            disabled={isPending || selected.size === 0}
          >
            {selected.size > 0
              ? `Publish ${selected.size} selected`
              : "Publish selected"}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No moneylines yet for week {week}. Generate them above once ESPN
          projections are synced.
        </p>
      ) : (
        rows.map((row) => (
          <MoneylineRow
            key={row.marketId}
            row={row}
            globalVig={Number(globalVig) || DEFAULT_VIG}
            selected={selected.has(row.marketId)}
            onToggleSelected={toggleSelected}
          />
        ))
      )}
    </div>
  );
}
