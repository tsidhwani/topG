"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useBetSlip } from "./bet-slip-context";
import { placeBet } from "@/lib/actions/bets";
import { payoutCents, parlayPayoutCents } from "@/lib/odds";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function dollarsToCents(value: string): number {
  const n = Math.round(Number(value) * 100);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function BetSlipDrawer() {
  const router = useRouter();
  const { selections, removeSelection, clear } = useBetSlip();
  const [open, setOpen] = useState(false);
  const [singleStakes, setSingleStakes] = useState<Record<string, string>>({});
  const [parlayStake, setParlayStake] = useState("");
  const [isPending, startTransition] = useTransition();

  if (selections.length === 0) return null;

  function handlePlaceSingles() {
    startTransition(async () => {
      try {
        let placed = 0;
        for (const s of selections) {
          const stakeCents = dollarsToCents(singleStakes[s.id] ?? "");
          if (stakeCents <= 0) continue;
          await placeBet("single", stakeCents, [s.id]);
          placed += 1;
        }
        if (placed === 0) {
          toast.error("Enter a stake on at least one selection.");
          return;
        }
        toast.success(`Placed ${placed} bet${placed === 1 ? "" : "s"}.`);
        setSingleStakes({});
        clear();
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function handlePlaceParlay() {
    const stakeCents = dollarsToCents(parlayStake);
    if (stakeCents <= 0) {
      toast.error("Enter a stake.");
      return;
    }
    startTransition(async () => {
      try {
        await placeBet(
          "parlay",
          stakeCents,
          selections.map((s) => s.id),
        );
        toast.success("Parlay placed.");
        setParlayStake("");
        clear();
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  const parlayOdds = selections.map((s) => s.americanOdds);
  const parlayStakeCents = dollarsToCents(parlayStake);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button className="animate-glow-pulse fixed bottom-4 left-1/2 z-40 -translate-x-1/2 transition-transform hover:scale-105 active:scale-95" />
        }
      >
        Bet slip ({selections.length})
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="font-heading text-xl text-primary">
            Bet Slip
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-2 overflow-y-auto px-4">
          {selections.map((s, i) => (
            <div
              key={s.id}
              className="stagger-in flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors"
              style={{ "--stagger": `${i * 40}ms` } as React.CSSProperties}
            >
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {s.marketTitle}
                </span>
                <span>
                  {s.label}
                  {s.line != null ? ` (${s.line})` : ""} (
                  {s.americanOdds > 0 ? `+${s.americanOdds}` : s.americanOdds})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeSelection(s.id)}
                aria-label={`Remove ${s.label}`}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <Tabs defaultValue="singles" className="px-4">
          <TabsList>
            <TabsTrigger value="singles">Singles</TabsTrigger>
            <TabsTrigger value="parlay" disabled={selections.length < 2}>
              Parlay
            </TabsTrigger>
          </TabsList>

          <TabsContent value="singles" className="flex flex-col gap-3 pt-3">
            {selections.map((s) => {
              const stakeCents = dollarsToCents(singleStakes[s.id] ?? "");
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <Label className="w-24 shrink-0 truncate text-xs">
                    {s.label}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="$ stake"
                    value={singleStakes[s.id] ?? ""}
                    onChange={(e) =>
                      setSingleStakes((prev) => ({
                        ...prev,
                        [s.id]: e.target.value,
                      }))
                    }
                  />
                  <span className="w-20 shrink-0 text-right text-xs font-medium text-primary">
                    {stakeCents > 0
                      ? `$${centsToDollars(payoutCents(s.americanOdds, stakeCents))}`
                      : ""}
                  </span>
                </div>
              );
            })}
            <Button
              type="button"
              disabled={isPending}
              onClick={handlePlaceSingles}
            >
              {isPending ? "Placing..." : "Place bets"}
            </Button>
          </TabsContent>

          <TabsContent value="parlay" className="flex flex-col gap-3 pt-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="parlay-stake" className="shrink-0 text-xs">
                Stake
              </Label>
              <Input
                id="parlay-stake"
                type="number"
                min="0"
                step="0.01"
                placeholder="$ stake"
                value={parlayStake}
                onChange={(e) => setParlayStake(e.target.value)}
              />
              <span className="w-24 shrink-0 text-right text-xs font-medium text-primary">
                {parlayStakeCents > 0
                  ? `$${centsToDollars(parlayPayoutCents(parlayOdds, parlayStakeCents))}`
                  : ""}
              </span>
            </div>
            <Button type="button" disabled={isPending} onClick={handlePlaceParlay}>
              {isPending ? "Placing..." : "Place parlay"}
            </Button>
          </TabsContent>
        </Tabs>

        <SheetFooter className="flex-row items-center justify-between">
          <span className="text-[0.65rem] tracking-[0.2em] text-muted-foreground/70 uppercase">
            Tight Margins
          </span>
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Clear slip
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
