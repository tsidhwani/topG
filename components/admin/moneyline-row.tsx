"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { relinkTwoWayOdds } from "@/lib/odds";
import { saveDraft, publishMarket, removeDraft } from "@/lib/actions/suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface MoneylineDraftRow {
  marketId: string;
  title: string;
  status: string;
  lockAt: string | null;
  vigOverride: number | null;
  home: { selectionId: string; label: string; americanOdds: number };
  away: { selectionId: string; label: string; americanOdds: number };
  reference: {
    homeProjected: number;
    awayProjected: number;
    homeWinProbability: number;
    homeFairOdds: number;
    awayFairOdds: number;
    suggestedHomeOdds: number;
    suggestedAwayOdds: number;
  } | null;
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MoneylineRow({
  row,
  globalVig,
  selected,
  onToggleSelected,
}: {
  row: MoneylineDraftRow;
  globalVig: number;
  selected: boolean;
  onToggleSelected: (marketId: string, checked: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(row.title);
  const [homeOdds, setHomeOdds] = useState(String(row.home.americanOdds));
  const [awayOdds, setAwayOdds] = useState(String(row.away.americanOdds));
  const [lockAt, setLockAt] = useState(
    row.lockAt ? toLocalInputValue(row.lockAt) : "",
  );
  const [vigOverride, setVigOverride] = useState(
    row.vigOverride != null ? String(row.vigOverride) : "",
  );
  const [linked, setLinked] = useState(true);
  const [isPending, startTransition] = useTransition();

  const editable = row.status === "draft" || row.status === "open";
  const effectiveVig = vigOverride ? Number(vigOverride) : globalVig;

  const changedFromSuggested = useMemo(() => {
    if (!row.reference) return false;
    return (
      Number(homeOdds) !== row.reference.suggestedHomeOdds ||
      Number(awayOdds) !== row.reference.suggestedAwayOdds
    );
  }, [homeOdds, awayOdds, row.reference]);

  function handleHomeOddsChange(value: string) {
    setHomeOdds(value);
    if (linked && value && !Number.isNaN(Number(value))) {
      try {
        setAwayOdds(String(relinkTwoWayOdds(Number(value), effectiveVig)));
      } catch {
        // out-of-range intermediate typing state — leave away side alone
      }
    }
  }

  function handleAwayOddsChange(value: string) {
    setAwayOdds(value);
    if (linked && value && !Number.isNaN(Number(value))) {
      try {
        setHomeOdds(String(relinkTwoWayOdds(Number(value), effectiveVig)));
      } catch {
        // out-of-range intermediate typing state — leave home side alone
      }
    }
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveDraft({
          marketId: row.marketId,
          title,
          lockAt: lockAt ? new Date(lockAt).toISOString() : null,
          vigOverride: vigOverride ? Number(vigOverride) : null,
          selections: [
            { id: row.home.selectionId, americanOdds: Number(homeOdds), line: null },
            { id: row.away.selectionId, americanOdds: Number(awayOdds), line: null },
          ],
        });
        toast.success(`"${title}" saved.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        await handleSaveSync();
        await publishMarket(row.marketId);
        toast.success(`"${title}" published.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not publish");
      }
    });
  }

  // Saves whatever's currently in the edit fields before publishing, so
  // "Publish" always ships the latest edits rather than requiring a
  // separate Save first.
  async function handleSaveSync() {
    await saveDraft({
      marketId: row.marketId,
      title,
      lockAt: lockAt ? new Date(lockAt).toISOString() : null,
      vigOverride: vigOverride ? Number(vigOverride) : null,
      selections: [
        { id: row.home.selectionId, americanOdds: Number(homeOdds), line: null },
        { id: row.away.selectionId, americanOdds: Number(awayOdds), line: null },
      ],
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeDraft(row.marketId);
        toast.success(`"${title}" removed.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not remove");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {row.status === "draft" && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleSelected(row.marketId, e.target.checked)}
              className="mt-1.5 size-4 accent-primary"
              aria-label={`Select ${title} for bulk publish`}
            />
          )}
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <Badge variant={row.status === "open" ? "default" : "secondary"}>
          {row.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {row.reference && (
          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
            <span>
              {row.reference.homeProjected.toFixed(1)} proj (
              {(row.reference.homeWinProbability * 100).toFixed(0)}% win) · fair{" "}
              {formatOdds(row.reference.homeFairOdds)} · suggested{" "}
              {formatOdds(row.reference.suggestedHomeOdds)}
            </span>
            <span>
              {row.reference.awayProjected.toFixed(1)} proj (
              {((1 - row.reference.homeWinProbability) * 100).toFixed(0)}% win) ·
              fair {formatOdds(row.reference.awayFairOdds)} · suggested{" "}
              {formatOdds(row.reference.suggestedAwayOdds)}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`title-${row.marketId}`}>Title</Label>
          <Input
            id={`title-${row.marketId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!editable}
          />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`home-${row.marketId}`}>{row.home.label}</Label>
            <Input
              id={`home-${row.marketId}`}
              type="number"
              value={homeOdds}
              onChange={(e) => handleHomeOddsChange(e.target.value)}
              disabled={!editable}
              className="font-heading text-primary"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`away-${row.marketId}`}>{row.away.label}</Label>
            <Input
              id={`away-${row.marketId}`}
              type="number"
              value={awayOdds}
              onChange={(e) => handleAwayOddsChange(e.target.value)}
              disabled={!editable}
              className="font-heading text-primary"
            />
          </div>
        </div>

        {changedFromSuggested && (
          <p className="text-xs text-primary">You changed this from the suggested odds.</p>
        )}

        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={linked}
              onChange={(e) => setLinked(e.target.checked)}
              disabled={!editable}
              className="size-3.5 accent-primary"
            />
            Linked odds
          </label>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`vig-${row.marketId}`} className="text-[0.65rem]">
              Vig override
            </Label>
            <Input
              id={`vig-${row.marketId}`}
              type="number"
              step="0.005"
              placeholder={globalVig.toString()}
              value={vigOverride}
              onChange={(e) => setVigOverride(e.target.value)}
              disabled={!editable}
              className="h-7 w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`lock-${row.marketId}`} className="text-[0.65rem]">
              Lock time
            </Label>
            <Input
              id={`lock-${row.marketId}`}
              type="datetime-local"
              value={lockAt}
              onChange={(e) => setLockAt(e.target.value)}
              disabled={!editable}
              className="h-7"
            />
          </div>
        </div>

        {editable && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : "Save draft"}
            </Button>
            {row.status === "draft" && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePublish}
                  disabled={isPending}
                >
                  Publish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemove}
                  disabled={isPending}
                >
                  Remove
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
