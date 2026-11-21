"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { simulateMoneyline, DEFAULT_VIG } from "@/lib/suggestions/simulate";

export interface MoneylinePayload {
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  home_projected: number;
  away_projected: number;
  home_win_probability: number;
  home_fair_odds: number;
  away_fair_odds: number;
  home_odds: number;
  away_odds: number;
  vig: number;
}

// Generates a moneyline draft market (and its originating suggestion row,
// kept purely as read-only reference data) for every matchup this week
// that has synced ESPN projections. No separate "accept" step — generating
// *is* creating the editable draft; see docs in the Lines Studio UI.
export async function generateMoneylineSuggestions(
  season: number,
  week: number,
  vig: number = DEFAULT_VIG,
) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  await supabase
    .from("weeks")
    .upsert({ season, week }, { onConflict: "season,week", ignoreDuplicates: true });

  // Regenerating only replaces markets that are still drafts -- anything
  // already published is left alone, even if the admin clicks Generate
  // again later in the week.
  const { data: staleDrafts } = await supabase
    .from("markets")
    .select("id")
    .eq("season", season)
    .eq("week", week)
    .eq("type", "moneyline")
    .eq("source", "suggested")
    .eq("status", "draft");

  if (staleDrafts && staleDrafts.length > 0) {
    const staleIds = staleDrafts.map((m) => m.id);
    await supabase.from("suggestions").delete().in("accepted_market_id", staleIds);
    await supabase.from("markets").delete().in("id", staleIds); // selections cascade
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

  let created = 0;

  for (const m of matchups) {
    const sim = simulateMoneyline(m.home_projected, m.away_projected, undefined, vig);
    const homeTeamName = teamName.get(m.home_team_id) ?? `Team ${m.home_team_id}`;
    const awayTeamName = teamName.get(m.away_team_id) ?? `Team ${m.away_team_id}`;

    const payload: MoneylinePayload = {
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      home_team_name: homeTeamName,
      away_team_name: awayTeamName,
      home_projected: m.home_projected,
      away_projected: m.away_projected,
      home_win_probability: sim.homeWinProbability,
      home_fair_odds: sim.homeFairOdds,
      away_fair_odds: sim.awayFairOdds,
      home_odds: sim.homeOdds,
      away_odds: sim.awayOdds,
      vig,
    };

    const { data: market, error: marketError } = await supabase
      .from("markets")
      .insert({
        season,
        week,
        type: "moneyline",
        title: `${awayTeamName} @ ${homeTeamName}`,
        status: "draft",
        created_by: user.id,
        source: "suggested",
        linked_ids: {
          type: "moneyline",
          home_team_id: m.home_team_id,
          away_team_id: m.away_team_id,
          home_label: homeTeamName,
          away_label: awayTeamName,
        },
      })
      .select("id")
      .single();
    if (marketError) throw new Error(marketError.message);

    const { error: selectionsError } = await supabase.from("selections").insert([
      { market_id: market.id, label: homeTeamName, american_odds: sim.homeOdds },
      { market_id: market.id, label: awayTeamName, american_odds: sim.awayOdds },
    ]);
    if (selectionsError) throw new Error(selectionsError.message);

    const { error: suggestionError } = await supabase.from("suggestions").insert({
      season,
      week,
      type: "moneyline",
      payload,
      accepted_market_id: market.id,
    });
    if (suggestionError) throw new Error(suggestionError.message);

    created++;
  }

  revalidatePath("/admin/suggestions");
  return created;
}

export interface SelectionEdit {
  id: string;
  americanOdds: number;
  line: number | null;
}

interface SaveDraftInput {
  marketId: string;
  title: string;
  lockAt: string | null;
  vigOverride: number | null;
  selections: SelectionEdit[];
}

// Allowed on a draft, or on an already-published market as long as it
// hasn't locked yet -- a published market can still be edited until lock.
async function assertEditable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marketId: string,
) {
  const { data: market, error } = await supabase
    .from("markets")
    .select("status, lock_at")
    .eq("id", marketId)
    .single();
  if (error) throw new Error(error.message);

  if (market.status === "locked" || market.status === "graded" || market.status === "void") {
    throw new Error("this market is no longer editable");
  }
  if (market.lock_at && new Date(market.lock_at) <= new Date()) {
    throw new Error("this market has already locked");
  }
}

export async function saveDraft(input: SaveDraftInput) {
  await requireAdmin();
  const supabase = await createClient();
  await assertEditable(supabase, input.marketId);

  const { error: marketError } = await supabase
    .from("markets")
    .update({
      title: input.title,
      lock_at: input.lockAt,
      vig_override: input.vigOverride,
    })
    .eq("id", input.marketId);
  if (marketError) throw new Error(marketError.message);

  for (const selection of input.selections) {
    const { error } = await supabase
      .from("selections")
      .update({ american_odds: selection.americanOdds, line: selection.line })
      .eq("id", selection.id)
      .eq("market_id", input.marketId);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/suggestions");
}

export async function publishMarket(marketId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: market, error: fetchError } = await supabase
    .from("markets")
    .select("season, week, status")
    .eq("id", marketId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (market.status !== "draft") throw new Error("only drafts can be published");

  await publishMarketIds(supabase, [marketId]);
  await openWeekIfDraft(supabase, market.season, market.week);

  revalidatePath("/admin/suggestions");
  revalidatePath("/");
}

export async function publishMarkets(marketIds: string[]) {
  await requireAdmin();
  if (marketIds.length === 0) return;
  const supabase = await createClient();

  const { data: markets, error: fetchError } = await supabase
    .from("markets")
    .select("season, week")
    .in("id", marketIds)
    .eq("status", "draft");
  if (fetchError) throw new Error(fetchError.message);

  await publishMarketIds(supabase, marketIds);

  const weekPairs = new Map(markets?.map((m) => [`${m.season}-${m.week}`, m]));
  for (const { season, week } of weekPairs.values()) {
    await openWeekIfDraft(supabase, season, week);
  }

  revalidatePath("/admin/suggestions");
  revalidatePath("/");
}

async function publishMarketIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  marketIds: string[],
) {
  const { error } = await supabase
    .from("markets")
    .update({ status: "open" })
    .in("id", marketIds)
    .eq("status", "draft");
  if (error) throw new Error(error.message);
}

async function openWeekIfDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  season: number,
  week: number,
) {
  const { data: weekRow } = await supabase
    .from("weeks")
    .select("status")
    .eq("season", season)
    .eq("week", week)
    .maybeSingle();

  if (weekRow?.status === "draft") {
    await supabase
      .from("weeks")
      .update({ status: "open", lines_publish_at: new Date().toISOString() })
      .eq("season", season)
      .eq("week", week);
  }
}

export async function removeDraft(marketId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: market, error: fetchError } = await supabase
    .from("markets")
    .select("status")
    .eq("id", marketId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  if (market.status !== "draft") {
    throw new Error("only drafts can be removed — a published market may already have bets");
  }

  await supabase.from("suggestions").delete().eq("accepted_market_id", marketId);
  const { error } = await supabase.from("markets").delete().eq("id", marketId); // selections cascade
  if (error) throw new Error(error.message);

  revalidatePath("/admin/suggestions");
}
