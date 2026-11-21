"use server";

import { revalidatePath } from "next/cache";
import { probabilityToAmericanOdds } from "@/lib/odds";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { simulateTeamExtremes, DEFAULT_VIG } from "@/lib/suggestions/simulate";

export interface TeamExtremesPayload {
  kind: "highest" | "lowest";
  vig: number;
  teams: {
    team_id: number;
    team_name: string;
    projected: number;
    probability: number;
    fair_odds: number;
    suggested_odds: number;
  }[];
}

// Generates both "Highest Scoring Team" and "Lowest Scoring Team" draft
// markets for the week from one 10-team Monte Carlo (simulateTeamExtremes).
// Same editable-draft shape as moneylines (item 3): a suggestions row kept
// as read-only reference, a draft market + one selection per team.
export async function generateTeamExtremes(
  season: number,
  week: number,
  vig: number = DEFAULT_VIG,
): Promise<number> {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  await supabase
    .from("weeks")
    .upsert({ season, week }, { onConflict: "season,week", ignoreDuplicates: true });

  const { data: staleDrafts } = await supabase
    .from("markets")
    .select("id")
    .eq("season", season)
    .eq("week", week)
    .eq("type", "team_prop")
    .eq("status", "draft");
  if (staleDrafts && staleDrafts.length > 0) {
    const staleIds = staleDrafts.map((m) => m.id);
    await supabase.from("suggestions").delete().in("accepted_market_id", staleIds);
    await supabase.from("markets").delete().in("id", staleIds);
  }

  const { data: matchups, error: matchupsError } = await supabase
    .from("espn_matchups")
    .select("home_team_id, away_team_id, home_projected, away_projected")
    .eq("season", season)
    .eq("week", week)
    .not("home_projected", "is", null)
    .not("away_projected", "is", null);
  if (matchupsError) throw new Error(matchupsError.message);
  if (!matchups || matchups.length === 0) return 0;

  const { data: teams, error: teamsError } = await supabase
    .from("espn_teams")
    .select("espn_team_id, name")
    .eq("season", season);
  if (teamsError) throw new Error(teamsError.message);
  const teamName = new Map((teams ?? []).map((t) => [t.espn_team_id, t.name]));

  const projectedByTeam = new Map<number, number>();
  for (const m of matchups) {
    projectedByTeam.set(m.home_team_id, m.home_projected);
    projectedByTeam.set(m.away_team_id, m.away_projected);
  }
  const projections = [...projectedByTeam.entries()].map(([teamId, projected]) => ({
    teamId,
    projected,
  }));
  if (projections.length < 2) return 0;

  const sim = simulateTeamExtremes(projections, undefined, vig);

  let created = 0;
  for (const kind of ["highest", "lowest"] as const) {
    const results = sim[kind];
    const title = kind === "highest" ? "Highest Scoring Team" : "Lowest Scoring Team";

    const { data: market, error: marketError } = await supabase
      .from("markets")
      .insert({
        season,
        week,
        type: "team_prop",
        title,
        status: "draft",
        created_by: user.id,
        source: "suggested",
        linked_ids: {
          type: "team_prop",
          kind,
          teams: results.map((r) => ({
            team_id: r.teamId,
            label: teamName.get(r.teamId) ?? `Team ${r.teamId}`,
          })),
        },
      })
      .select("id")
      .single();
    if (marketError) throw new Error(marketError.message);

    const { error: selectionsError } = await supabase.from("selections").insert(
      results.map((r) => ({
        market_id: market.id,
        label: teamName.get(r.teamId) ?? `Team ${r.teamId}`,
        american_odds: r.americanOdds,
      })),
    );
    if (selectionsError) throw new Error(selectionsError.message);

    const payload: TeamExtremesPayload = {
      kind,
      vig,
      teams: results.map((r) => ({
        team_id: r.teamId,
        team_name: teamName.get(r.teamId) ?? `Team ${r.teamId}`,
        projected: projectedByTeam.get(r.teamId) ?? 0,
        probability: r.probability,
        fair_odds: probabilityToAmericanOdds(r.probability),
        suggested_odds: r.americanOdds,
      })),
    };

    const { error: suggestionError } = await supabase.from("suggestions").insert({
      season,
      week,
      type: `team_prop_${kind}`,
      payload,
      accepted_market_id: market.id,
    });
    if (suggestionError) throw new Error(suggestionError.message);

    created++;
  }

  revalidatePath("/admin/lines-studio");
  return created;
}
