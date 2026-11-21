import { createClient } from "@/lib/supabase/server";
import { getCurrentWeek } from "@/lib/weeks";
import { MoneylineStudio } from "@/components/admin/moneyline-studio";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MoneylinePayload } from "@/lib/actions/suggestions";
import type { MoneylineDraftRow } from "@/components/admin/moneyline-row";

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

export default async function AdminSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const params = await searchParams;
  const season = Number(params.season) || new Date().getFullYear();
  const supabase = await createClient();
  const week = Number(params.week) || (await getCurrentWeek(supabase, season));

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

  const rows: MoneylineDraftRow[] = markets
    .map((m): MoneylineDraftRow | null => {
      const payload = suggestionByMarketId.get(m.id);
      const home = m.selections.find((s) => s.label === payload?.home_team_name);
      const away = m.selections.find((s) => s.label === payload?.away_team_name);
      if (!home || !away) return null; // labels edited away from the original pairing

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <PageHeading title="Suggestions" tagline="Tight Margins" />

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

      <MoneylineStudio season={season} week={week} rows={rows} />
    </div>
  );
}
