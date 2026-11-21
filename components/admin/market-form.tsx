"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMarket } from "@/lib/actions/admin-lines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MARKET_TYPES = [
  { value: "moneyline", label: "Moneyline" },
  { value: "spread", label: "Spread" },
  { value: "total", label: "Total" },
  { value: "player_prop", label: "Player Prop" },
  { value: "future", label: "Future" },
];

interface SelectionRow {
  label: string;
  americanOdds: string;
  line: string;
}

const emptyRow: SelectionRow = { label: "", americanOdds: "", line: "" };

export function MarketForm({ season, week }: { season: number; week: number }) {
  const router = useRouter();
  const [type, setType] = useState("moneyline");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lockAt, setLockAt] = useState("");
  const [rows, setRows] = useState<SelectionRow[]>([
    { ...emptyRow },
    { ...emptyRow },
  ]);
  const [isPending, startTransition] = useTransition();

  function updateRow(index: number, patch: Partial<SelectionRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createMarket({
          season,
          week,
          type,
          title,
          description: description || null,
          lockAt: lockAt ? new Date(lockAt).toISOString() : null,
          selections: rows.map((r) => ({
            label: r.label,
            americanOdds: Number(r.americanOdds),
            line: r.line ? Number(r.line) : null,
          })),
        });
        toast.success(`"${title}" saved as a draft.`);
        setTitle("");
        setDescription("");
        setLockAt("");
        setRows([{ ...emptyRow }, { ...emptyRow }]);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a market</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="market-type">Type</Label>
            <select
              id="market-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {MARKET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team A vs Team B"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lock_at">
              Lock time (optional, defaults to the week&apos;s)
            </Label>
            <Input
              id="lock_at"
              type="datetime-local"
              value={lockAt}
              onChange={(e) => setLockAt(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Selections</Label>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="Label (e.g. Team A)"
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  required
                />
                <Input
                  placeholder="Odds (-150)"
                  type="number"
                  value={row.americanOdds}
                  onChange={(e) => updateRow(i, { americanOdds: e.target.value })}
                  className="w-32"
                  required
                />
                <Input
                  placeholder="Line (70.5)"
                  type="number"
                  step="0.5"
                  value={row.line}
                  onChange={(e) => updateRow(i, { line: e.target.value })}
                  className="w-28"
                />
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => removeRow(i)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addRow}>
              + Add selection
            </Button>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save as draft"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
