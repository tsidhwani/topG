"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { relinkTwoWayOdds } from "@/lib/odds";
import { saveDraft, publishMarket, removeDraft } from "@/lib/actions/suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface PlayerPropDraftRow {
  marketId: string;
  title: string;
  status: string;
  lockAt: string | null;
  vigOverride: number | null;
  hasLine: boolean;
  first: { selectionId: string; label: string; americanOdds: number; playerName: string; projected: number };
  second: { selectionId: string; label: string; americanOdds: number; playerName: string; projected: number };
  line: number | null;
  injuryNote: string | null;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlayerPropRow({
  row,
  globalVig,
}: {
  row: PlayerPropDraftRow;
  globalVig: number;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(row.title);
  const [firstOdds, setFirstOdds] = useState(String(row.first.americanOdds));
  const [secondOdds, setSecondOdds] = useState(String(row.second.americanOdds));
  const [lockAt, setLockAt] = useState(row.lockAt ? toLocalInputValue(row.lockAt) : "");
  const [vigOverride, setVigOverride] = useState(
    row.vigOverride != null ? String(row.vigOverride) : "",
  );
  const [linked, setLinked] = useState(true);
  const [isPending, startTransition] = useTransition();

  const editable = row.status === "draft" || row.status === "open";
  const effectiveVig = vigOverride ? Number(vigOverride) : globalVig;

  function handleFirstChange(value: string) {
    setFirstOdds(value);
    if (linked && value && !Number.isNaN(Number(value))) {
      try {
        setSecondOdds(String(relinkTwoWayOdds(Number(value), effectiveVig)));
      } catch {
        // out-of-range intermediate typing state
      }
    }
  }

  function handleSecondChange(value: string) {
    setSecondOdds(value);
    if (linked && value && !Number.isNaN(Number(value))) {
      try {
        setFirstOdds(String(relinkTwoWayOdds(Number(value), effectiveVig)));
      } catch {
        // out-of-range intermediate typing state
      }
    }
  }

  function buildSelections() {
    return [
      { id: row.first.selectionId, americanOdds: Number(firstOdds), line: row.line },
      { id: row.second.selectionId, americanOdds: Number(secondOdds), line: row.line },
    ];
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveDraft({
          marketId: row.marketId,
          title,
          lockAt: lockAt ? new Date(lockAt).toISOString() : null,
          vigOverride: vigOverride ? Number(vigOverride) : null,
          selections: buildSelections(),
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
        await saveDraft({
          marketId: row.marketId,
          title,
          lockAt: lockAt ? new Date(lockAt).toISOString() : null,
          vigOverride: vigOverride ? Number(vigOverride) : null,
          selections: buildSelections(),
        });
        await publishMarket(row.marketId);
        toast.success(`"${title}" published.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not publish");
      }
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant={row.status === "open" ? "default" : "secondary"}>
          {row.status}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {row.injuryNote && (
          <p className="text-xs text-destructive">{row.injuryNote}</p>
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
            <Label htmlFor={`first-${row.marketId}`}>
              {row.first.label}
              <span className="ml-1 text-muted-foreground">
                ({row.first.projected.toFixed(1)} proj)
              </span>
            </Label>
            <Input
              id={`first-${row.marketId}`}
              type="number"
              value={firstOdds}
              onChange={(e) => handleFirstChange(e.target.value)}
              disabled={!editable}
              className="font-heading text-primary"
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor={`second-${row.marketId}`}>
              {row.second.label}
              <span className="ml-1 text-muted-foreground">
                ({row.second.projected.toFixed(1)} proj)
              </span>
            </Label>
            <Input
              id={`second-${row.marketId}`}
              type="number"
              value={secondOdds}
              onChange={(e) => handleSecondChange(e.target.value)}
              disabled={!editable}
              className="font-heading text-primary"
            />
          </div>
        </div>

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
