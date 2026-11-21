import { createClient } from "@/lib/supabase/server";
import { getCurrentWeek } from "@/lib/weeks";
import { MoneylineStudio } from "@/components/admin/moneyline-studio";
import { TeamExtremesStudio } from "@/components/admin/team-extremes-studio";
import { PlayerPropsStudio } from "@/components/admin/player-props-studio";
import { MarketForm } from "@/components/admin/market-form";
import { getEligiblePlayers } from "@/lib/actions/player-props";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MoneylinePayload } from "@/lib/actions/suggestions";
import type { MoneylineDraftRow } from "@/components/admin/moneyline-row";
import type { TeamExtremesPayload } from "@/lib/actions/team-extremes";
import type { TeamExtremesDraftRow } from "@/components/admin/team-extremes-row";
import type { PlayerPropDraftRow } from "@/components/admin/player-prop-row";

interface H2hPayload {
  player_a: { id: number; name: string; projected: number };
  player_b: { id: number; name: string; projected: number };
}

interface OverUnderPayload {
  player?: { id: number; name: string; projected: number };
  players?: { id: number; name: string; projected: number }[];
  line: number;
}

interface MarketRow {
  id: string;
  title: string;
  status: string;
  lock_at: string | null;
  vig_override: number | null;
  selections: { id: string; label: string; american_odds: number }[];
}

interface SuggestionRow {
  accepted_market_id: string;
  payload: MoneylinePayload;
}

async function loadMoneylineRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  season: number,
  week: number,
): Promise<MoneylineDraftRow[]> {
  const { data: marketsData } = await supabase
    .from("markets")
    .select("id, title, status, lock_at, vig_override, selections(id, label, american_odds)")
    .eq("season", season)
    .eq("week", week)
    .eq("type", "moneyline")
    .order("created_at", { ascending: true });

  const { data: suggestionsData } = await supabase
    .from("suggestions")
    .select("accepted_market_id, payload")
    .eq("season", season)
    .eq("week", week)
    .eq("type", "moneyline")
    .not("accepted_market_id", "is", null);

  const markets = (marketsData ?? []) as unknown as MarketRow[];
  const suggestionByMarketId = new Map(
    ((suggestionsData ?? []) as unknown as SuggestionRow[]).map((s) => [
      s.accepted_market_id,
      s.payload,
    ]),
  );

  return markets
    .map((m): MoneylineDraftRow | null => {
      const payload = suggestionByMarketId.get(m.id);
      const home = m.selections.find((s) => s.label === payload?.home_team_name);
      const away = m.selections.find((s) => s.label === payload?.away_team_name);
      if (!home || !away) return null;

      return {
        marketId: m.id,
        title: m.title,
        status: m.status,
        lockAt: m.lock_at,
        vigOverride: m.vig_override,
        home: { selectionId: home.id, label: home.label, americanOdds: home.american_odds },
        away: { selectionId: away.id, label: away.label, americanOdds: away.american_odds },
        reference: payload
          ? {
              homeProjected: payload.home_projected,
              awayProjected: payload.away_projected,
              homeWinProbability: payload.home_win_probability,
              homeFairOdds: payload.home_fair_odds,
              awayFairOdds: payload.away_fair_odds,
              suggestedHomeOdds: payload.home_odds,
              suggestedAwayOdds: payload.away_odds,
            }
          : null,
      };
    })
    .filter((r): r is MoneylineDraftRow => r !== null);
}

async function loadTeamExtremesRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  season: number,
  week: number,
): Promise<TeamExtremesDraftRow[]> {
  const { data: marketsData } = await supabase
    .from("markets")
    .select("id, title, status, lock_at, vig_override, selections(id, label, american_odds)")
    .eq("season", season)
    .eq("week", week)
    .eq("type", "team_prop")
    .order("created_at", { ascending: true });

  const { data: suggestionsData } = await supabase
    .from("suggestions")
    .select("accepted_market_id, payload")
    .eq("season", season)
    .eq("week", week)
    .in("type", ["team_prop_highest", "team_prop_lowest"])
    .not("accepted_market_id", "is", null);

  const markets = (marketsData ?? []) as unknown as MarketRow[];
  const payloadByMarketId = new Map(
    ((suggestionsData ?? []) as unknown as SuggestionRow[]).map((s) => [
      s.accepted_market_id,
      s.payload as unknown as TeamExtremesPayload,
    ]),
  );

  return markets.map((m): TeamExtremesDraftRow => {
    const payload = payloadByMarketId.get(m.id);
    const nameToTeamId = new Map(
      (payload?.teams ?? []).map((t) => [t.team_name, t.team_id]),
    );
    const reference = payload
      ? Object.fromEntries(
          payload.teams.map((t) => [
            t.team_id,
            {
              projected: t.projected,
              probability: t.probability,
              fairOdds: t.fair_odds,
              suggestedOdds: t.suggested_odds,
            },
          ]),
        )
      : null;

    return {
      marketId: m.id,
      title: m.title,
      status: m.status,
      lockAt: m.lock_at,
      vigOverride: m.vig_override,
      selections: m.selections.map((s) => ({
        selectionId: s.id,
        teamId: nameToTeamId.get(s.label) ?? -1,
        label: s.label,
        americanOdds: s.american_odds,
      })),
      reference,
    };
  });
}

async function loadPlayerPropRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  season: number,
  week: number,
): Promise<PlayerPropDraftRow[]> {
  const { data: marketsData } = await supabase
    .from("markets")
    .select("id, title, status, lock_at, vig_override, selections(id, label, american_odds)")
    .eq("season", season)
    .eq("week", week)
    .eq("type", "player_prop")
    .order("created_at", { ascending: true });

  const { data: suggestionsData } = await supabase
    .from("suggestions")
    .select("type, accepted_market_id, payload")
    .eq("season", season)
    .eq("week", week)
    .in("type", ["player_prop_h2h", "player_prop_combo", "player_prop_single"])
    .not("accepted_market_id", "is", null);

  const { data: injuries } = await supabase
    .from("espn_player_weeks")
    .select("player_id, injury_status")
    .eq("season", season)
    .eq("week", week)
    .not("injury_status", "is", null);
  const injuryByPlayerId = new Map((injuries ?? []).map((i) => [i.player_id, i.injury_status]));

  const markets = (marketsData ?? []) as unknown as MarketRow[];
  const suggestionByMarketId = new Map(
    (suggestionsData ?? []).map((s) => [s.accepted_market_id, s]),
  );

  return markets
    .map((m): PlayerPropDraftRow | null => {
      const suggestion = suggestionByMarketId.get(m.id);
      if (!suggestion) return null;

      if (suggestion.type === "player_prop_h2h") {
        const payload = suggestion.payload as unknown as H2hPayload;
        const aLabel = `${payload.player_a.name} to outscore ${payload.player_b.name}`;
        const bLabel = `${payload.player_b.name} to outscore ${payload.player_a.name}`;
        const first = m.selections.find((s) => s.label === aLabel);
        const second = m.selections.find((s) => s.label === bLabel);
        if (!first || !second) return null;

        const injuryA = injuryByPlayerId.get(payload.player_a.id);
        const injuryB = injuryByPlayerId.get(payload.player_b.id);

        return {
          marketId: m.id,
          title: m.title,
          status: m.status,
          lockAt: m.lock_at,
          vigOverride: m.vig_override,
          hasLine: false,
          line: null,
          first: {
            selectionId: first.id,
            label: first.label,
            americanOdds: first.american_odds,
            playerName: payload.player_a.name,
            projected: payload.player_a.projected,
          },
          second: {
            selectionId: second.id,
            label: second.label,
            americanOdds: second.american_odds,
            playerName: payload.player_b.name,
            projected: payload.player_b.projected,
          },
          injuryNote:
            injuryA || injuryB
              ? `${injuryA ? `${payload.player_a.name}: ${injuryA}` : ""}${injuryA && injuryB ? " · " : ""}${injuryB ? `${payload.player_b.name}: ${injuryB}` : ""}`
              : null,
        };
      }

      // combo and single share the same Over/Under shape
      const payload = suggestion.payload as unknown as OverUnderPayload;
      const line = payload.line;
      const over = m.selections.find((s) => s.label.startsWith("Over"));
      const under = m.selections.find((s) => s.label.startsWith("Under"));
      if (!over || !under) return null;

      const players = payload.players ?? (payload.player ? [payload.player] : []);
      const title =
        suggestion.type === "player_prop_combo"
          ? players.map((p) => p.name).join(" + ")
          : (players[0]?.name ?? m.title);
      const totalProjected = players.reduce((sum, p) => sum + p.projected, 0);
      const injuryNotes = players
        .filter((p) => injuryByPlayerId.get(p.id))
        .map((p) => `${p.name}: ${injuryByPlayerId.get(p.id)}`);

      return {
        marketId: m.id,
        title: m.title,
        status: m.status,
        lockAt: m.lock_at,
        vigOverride: m.vig_override,
        hasLine: true,
        line,
        first: {
          selectionId: over.id,
          label: over.label,
          americanOdds: over.american_odds,
          playerName: `Over — ${title}`,
          projected: totalProjected,
        },
        second: {
          selectionId: under.id,
          label: under.label,
          americanOdds: under.american_odds,
          playerName: `Under — ${title}`,
          projected: totalProjected,
        },
        injuryNote: injuryNotes.length > 0 ? injuryNotes.join(" · ") : null,
      };
    })
    .filter((r): r is PlayerPropDraftRow => r !== null);
}

export default async function LinesStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const params = await searchParams;
  const season = Number(params.season) || new Date().getFullYear();
  const supabase = await createClient();
  const week = Number(params.week) || (await getCurrentWeek(supabase, season));

  const moneylineRows = await loadMoneylineRows(supabase, season, week);
  const teamExtremesRows = await loadTeamExtremesRows(supabase, season, week);
  const playerPropRows = await loadPlayerPropRows(supabase, season, week);
  const eligiblePlayers = await getEligiblePlayers(supabase, season, week);
  const { data: fantasyTeamsData } = await supabase
    .from("espn_teams")
    .select("espn_team_id, name")
    .eq("season", season)
    .order("name", { ascending: true });
  const fantasyTeams = (fantasyTeamsData ?? []).map((t) => ({ id: t.espn_team_id, name: t.name }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <PageHeading title="Lines Studio" tagline="Tight Margins" />

      <form className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="season">Season</Label>
          <Input
            id="season"
            name="season"
            type="number"
            defaultValue={season}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="week">Week</Label>
          <Input
            id="week"
            name="week"
            type="number"
            defaultValue={week}
            className="w-20"
          />
        </div>
        <Button type="submit" variant="secondary">
          Switch
        </Button>
      </form>

      <Tabs defaultValue="moneylines">
        <TabsList>
          <TabsTrigger value="moneylines">Moneylines</TabsTrigger>
          <TabsTrigger value="player-props">Player Props</TabsTrigger>
          <TabsTrigger value="team-extremes">Top &amp; Bottom Scorer</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>

        <TabsContent value="moneylines" className="flex flex-col gap-4 pt-4">
          <MoneylineStudio season={season} week={week} rows={moneylineRows} />
        </TabsContent>

        <TabsContent value="player-props" className="flex flex-col gap-4 pt-4">
          <PlayerPropsStudio
            season={season}
            week={week}
            rows={playerPropRows}
            eligiblePlayers={eligiblePlayers}
            fantasyTeams={fantasyTeams}
          />
        </TabsContent>

        <TabsContent value="team-extremes" className="flex flex-col gap-4 pt-4">
          <TeamExtremesStudio season={season} week={week} rows={teamExtremesRows} />
        </TabsContent>

        <TabsContent value="custom" className="flex flex-col gap-4 pt-4">
          <MarketForm season={season} week={week} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
