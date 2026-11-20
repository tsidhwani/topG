import { createClient } from "@/lib/supabase/server";
import { acceptSuggestion, dismissSuggestion } from "@/lib/actions/suggestions";
import { GenerateSuggestionsButton } from "@/components/admin/generate-suggestions-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MoneylinePayload {
  home_team_name: string;
  away_team_name: string;
  home_projected: number;
  away_projected: number;
  home_odds: number;
  away_odds: number;
}

interface Suggestion {
  id: string;
  payload: MoneylinePayload;
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export default async function AdminSuggestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const params = await searchParams;
  const season = Number(params.season) || new Date().getFullYear();
  const week = Number(params.week) || 1;

  const supabase = await createClient();

  const { data: suggestionsData } = await supabase
    .from("suggestions")
    .select("id, payload")
    .eq("season", season)
    .eq("week", week)
    .eq("type", "moneyline")
    .is("accepted_market_id", null)
    .order("created_at", { ascending: true });

  const suggestions = (suggestionsData ?? []) as unknown as Suggestion[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Suggestions</h1>
      <p className="text-sm text-muted-foreground">
        Suggested moneylines from ESPN&apos;s projections, via a Monte Carlo
        simulation — not an LLM. Math only, so the numbers are explainable:
        each team&apos;s score is simulated as a normal distribution around
        its ESPN projection, and the win fraction becomes the odds, with a
        small built-in house edge.
      </p>

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

      <GenerateSuggestionsButton season={season} week={week} />

      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pending suggestions for this week. Click Generate (make sure
          ESPN has been synced for this week first).
        </p>
      ) : (
        suggestions.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {s.payload.away_team_name} @ {s.payload.home_team_name}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {s.payload.home_team_name} (proj {s.payload.home_projected.toFixed(1)})
                </span>
                <span className="font-medium tabular-nums">
                  {formatOdds(s.payload.home_odds)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {s.payload.away_team_name} (proj {s.payload.away_projected.toFixed(1)})
                </span>
                <span className="font-medium tabular-nums">
                  {formatOdds(s.payload.away_odds)}
                </span>
              </div>
              <div className="flex gap-2">
                <form action={acceptSuggestion.bind(null, s.id)}>
                  <Button type="submit" size="sm">
                    Accept (adds as a draft market)
                  </Button>
                </form>
                <form action={dismissSuggestion.bind(null, s.id)}>
                  <Button type="submit" size="sm" variant="outline">
                    Dismiss
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
