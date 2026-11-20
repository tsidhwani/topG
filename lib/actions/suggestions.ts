"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { simulateMoneyline } from "@/lib/suggestions/simulate";

interface MoneylinePayload {
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  home_projected: number;
  away_projected: number;
  home_odds: number;
  away_odds: number;
}

export async function generateSuggestions(season: number, week: number) {
  await requireAdmin();
  const supabase = await createClient();

  // Ensure the week exists so accepting a suggestion later can always
  // attach its market to it (markets.week references weeks).
  await supabase
    .from("weeks")
    .upsert({ season, week }, { onConflict: "season,week", ignoreDuplicates: true });

  // Clear out any not-yet-accepted suggestions for this week before
  // regenerating, so re-running doesn't pile up stale duplicates.
  const { error: deleteError } = await supabase
    .from("suggestions")
    .delete()
    .eq("season", season)
    .eq("week", week)
    .eq("type", "moneyline")
    .is("accepted_market_id", null);
  if (deleteError) throw new Error(deleteError.message);

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

  const rows = matchups.map((m) => {
    const { homeOdds, awayOdds } = simulateMoneyline(
      m.home_projected,
      m.away_projected,
    );
    const payload: MoneylinePayload = {
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_team_name: teamName.get(m.home_team_id) ?? `Team ${m.home_team_id}`,
      away_team_name: teamName.get(m.away_team_id) ?? `Team ${m.away_team_id}`,
      home_projected: m.home_projected,
      away_projected: m.away_projected,
      home_odds: homeOdds,
      away_odds: awayOdds,
    };
    return { season, week, type: "moneyline", payload };
  });

  const { error: insertError } = await supabase.from("suggestions").insert(rows);
  if (insertError) throw new Error(insertError.message);

  revalidatePath("/admin/suggestions");
  return rows.length;
}

export async function acceptSuggestion(suggestionId: string) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const { data: suggestion, error: fetchError } = await supabase
    .from("suggestions")
    .select("season, week, payload, accepted_market_id")
    .eq("id", suggestionId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (suggestion.accepted_market_id) throw new Error("already accepted");

  const payload = suggestion.payload as MoneylinePayload;

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .insert({
      season: suggestion.season,
      week: suggestion.week,
      type: "moneyline",
      title: `${payload.away_team_name} @ ${payload.home_team_name}`,
      status: "draft",
      created_by: user.id,
      source: "suggested",
      linked_ids: {
        type: "moneyline",
        home_team_id: payload.home_team_id,
        away_team_id: payload.away_team_id,
        home_label: payload.home_team_name,
        away_label: payload.away_team_name,
      },
    })
    .select("id")
    .single();
  if (marketError) throw new Error(marketError.message);

  const { error: selectionsError } = await supabase.from("selections").insert([
    { market_id: market.id, label: payload.home_team_name, american_odds: payload.home_odds },
    { market_id: market.id, label: payload.away_team_name, american_odds: payload.away_odds },
  ]);
  if (selectionsError) throw new Error(selectionsError.message);

  const { error: updateError } = await supabase
    .from("suggestions")
    .update({ accepted_market_id: market.id })
    .eq("id", suggestionId);
  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin/suggestions");
  revalidatePath("/admin/lines");
}

export async function dismissSuggestion(suggestionId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("suggestions")
    .delete()
    .eq("id", suggestionId)
    .is("accepted_market_id", null);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/suggestions");
}
