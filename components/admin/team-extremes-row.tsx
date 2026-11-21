"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveDraft, publishMarket, removeDraft } from "@/lib/actions/suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TeamExtremeReference {
  projected: number;
  probability: number;
  fairOdds: number;
  suggestedOdds: number;
}

export interface TeamExtremesDraftRow {
  marketId: string;
  title: string;
  status: string;
  lockAt: string | null;
  vigOverride: number | null;
  selections: { selectionId: string; teamId: number; label: string; americanOdds: number }[];
  reference: Record<number, TeamExtremeReference> | null;
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TeamExtremesRow({ row }: { row: TeamExtremesDraftRow }) {
  const router = useRouter();
  const [title, setTitle] = useState(row.title);
  const [odds, setOdds] = useState<Record<string, string>>(
    Object.fromEntries(row.selections.map((s) => [s.selectionId, String(s.americanOdds)])),
  );
  const [lockAt, setLockAt] = useState(row.lockAt ? toLocalInputValue(row.lockAt) : "");
  const [vigOverride, setVigOverride] = useState(
    row.vigOverride != null ? String(row.vigOverride) : "",
  );
  const [isPending, startTransition] = useTransition();

  const editable = row.status === "draft" || row.status === "open";

  function buildSelections() {
    return row.selections.map((s) => ({
      id: s.selectionId,
      americanOdds: Number(odds[s.selectionId]),
      line: null,
    }));
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
        <div className="flex flex-col gap-2">
          <Label htmlFor={`title-${row.marketId}`}>Title</Label>
          <Input
            id={`title-${row.marketId}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!editable}
          />
        </div>

        <div className="flex flex-col gap-2">
          {row.selections.map((s) => {
            const ref = row.reference?.[s.teamId];
            const current = Number(odds[s.selectionId]);
            const changed = ref ? current !== ref.suggestedOdds : false;
            return (
              <div key={s.selectionId} className="flex items-center gap-2">
                <div className="flex flex-1 flex-col">
                  <span className="truncate text-sm">{s.label}</span>
                  {ref && (
                    <span className="text-xs text-muted-foreground">
                      {ref.projected.toFixed(1)} proj · {(ref.probability * 100).toFixed(0)}% ·
                      fair {formatOdds(ref.fairOdds)}
                      {changed && <span className="text-primary"> · edited</span>}
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  value={odds[s.selectionId] ?? ""}
                  onChange={(e) =>
                    setOdds((prev) => ({ ...prev, [s.selectionId]: e.target.value }))
                  }
                  disabled={!editable}
                  className="w-24 font-heading text-primary"
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`vig-${row.marketId}`} className="text-[0.65rem]">
              Vig override
            </Label>
            <Input
              id={`vig-${row.marketId}`}
              type="number"
              step="0.005"
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
