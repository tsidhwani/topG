"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  generateHeadToHeadProps,
  generateComboProps,
  generateSinglePlayerProps,
  createCustomHeadToHead,
  createCustomCombo,
  type EligiblePlayer,
} from "@/lib/actions/player-props";
import { DEFAULT_VIG } from "@/lib/suggestions/simulate";
import { PlayerPropRow, type PlayerPropDraftRow } from "./player-prop-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PlayerPropsStudio({
  season,
  week,
  rows,
  eligiblePlayers,
  fantasyTeams,
}: {
  season: number;
  week: number;
  rows: PlayerPropDraftRow[];
  eligiblePlayers: EligiblePlayer[];
  fantasyTeams: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [vig, setVig] = useState(String(DEFAULT_VIG));
  const [teamFilter, setTeamFilter] = useState("");
  const [h2hCount, setH2hCount] = useState("3");
  const [comboCount, setComboCount] = useState("3");
  const [singleCount, setSingleCount] = useState("5");
  const [search, setSearch] = useState("");
  const [customH2h, setCustomH2h] = useState<number[]>([]);
  const [customCombo, setCustomCombo] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();

  const teamFilterId = teamFilter ? Number(teamFilter) : undefined;
  const effectiveVig = Number(vig) || DEFAULT_VIG;

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return eligiblePlayers
      .filter((p) => !term || p.playerName.toLowerCase().includes(term))
      .slice(0, 25);
  }, [eligiblePlayers, search]);

  function runGenerate(
    fn: (season: number, week: number, count: number, vig: number, teamFilter?: number) => Promise<number>,
    count: string,
    label: string,
  ) {
    startTransition(async () => {
      try {
        const n = await fn(season, week, Number(count) || 1, effectiveVig, teamFilterId);
        if (n === 0) {
          toast.error("No eligible players found — sync ESPN first, or widen the filter.");
        } else {
          toast.success(`Generated ${n} ${label}.`);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  function togglePick(list: number[], setList: (v: number[]) => void, playerId: number, max: number) {
    if (list.includes(playerId)) {
      setList(list.filter((id) => id !== playerId));
    } else if (list.length < max) {
      setList([...list, playerId]);
    }
  }

  function handleCreateCustomH2h() {
    if (customH2h.length !== 2) {
      toast.error("Pick exactly 2 players for a head-to-head.");
      return;
    }
    startTransition(async () => {
      try {
        await createCustomHeadToHead(season, week, customH2h[0], customH2h[1], effectiveVig);
        toast.success("Head-to-head created.");
        setCustomH2h([]);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create");
      }
    });
  }

  function handleCreateCustomCombo() {
    if (customCombo.length < 2 || customCombo.length > 3) {
      toast.error("Pick 2 or 3 players for a combo.");
      return;
    }
    startTransition(async () => {
      try {
        await createCustomCombo(season, week, customCombo, effectiveVig);
        toast.success("Combo prop created.");
        setCustomCombo([]);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not create");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="pp-vig" className="text-xs">
            Vig
          </Label>
          <Input
            id="pp-vig"
            type="number"
            step="0.005"
            value={vig}
            onChange={(e) => setVig(e.target.value)}
            className="w-24"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="pp-team-filter" className="text-xs">
            Fantasy team filter
          </Label>
          <select
            id="pp-team-filter"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">All teams</option>
            {fantasyTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
        <div className="flex flex-col gap-1">
          <Label className="text-[0.65rem]">How many</Label>
          <Input
            type="number"
            min="1"
            value={h2hCount}
            onChange={(e) => setH2hCount(e.target.value)}
            className="h-8 w-16"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => runGenerate(generateHeadToHeadProps, h2hCount, "head-to-head props")}
        >
          Generate player-vs-player
        </Button>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.65rem]">How many</Label>
          <Input
            type="number"
            min="1"
            value={comboCount}
            onChange={(e) => setComboCount(e.target.value)}
            className="h-8 w-16"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => runGenerate(generateComboProps, comboCount, "combo props")}
        >
          Generate combos
        </Button>

        <div className="flex flex-col gap-1">
          <Label className="text-[0.65rem]">How many</Label>
          <Input
            type="number"
            min="1"
            value={singleCount}
            onChange={(e) => setSingleCount(e.target.value)}
            className="h-8 w-16"
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => runGenerate(generateSinglePlayerProps, singleCount, "single-player props")}
        >
          Generate singles
        </Button>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Label htmlFor="pp-search" className="text-xs">
          Search players for a custom head-to-head or combo
        </Label>
        <Input
          id="pp-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
        />
        {search && (
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {filteredPlayers.map((p) => (
              <div key={p.playerId} className="flex items-center justify-between text-sm">
                <span>
                  {p.playerName} ({p.position}, {p.fantasyTeamName},{" "}
                  {p.projectedPoints.toFixed(1)} proj)
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={customH2h.includes(p.playerId) ? "default" : "outline"}
                    onClick={() => togglePick(customH2h, setCustomH2h, p.playerId, 2)}
                  >
                    H2H ({customH2h.length}/2)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={customCombo.includes(p.playerId) ? "default" : "outline"}
                    onClick={() => togglePick(customCombo, setCustomCombo, p.playerId, 3)}
                  >
                    Combo ({customCombo.length}/3)
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending || customH2h.length !== 2}
            onClick={handleCreateCustomH2h}
          >
            Create head-to-head
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending || customCombo.length < 2}
            onClick={handleCreateCustomCombo}
          >
            Create combo
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No player props yet for week {week}. Generate some above once ESPN
          is synced.
        </p>
      ) : (
        rows.map((row) => (
          <PlayerPropRow key={row.marketId} row={row} globalVig={effectiveVig} />
        ))
      )}
    </div>
  );
}
