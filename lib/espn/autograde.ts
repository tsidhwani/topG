import type { SupabaseClient } from "@supabase/supabase-js";
import { regradeAffectedBets } from "@/lib/bets/regrade";
import { compareTwoWay, gradeExtreme } from "./grading-logic";

export interface AutoGradeSummary {
  marketsGraded: number;
  betsRegraded: number;
}

function mergeSummaries(a: AutoGradeSummary, b: AutoGradeSummary): AutoGradeSummary {
  return {
    marketsGraded: a.marketsGraded + b.marketsGraded,
    betsRegraded: a.betsRegraded + b.betsRegraded,
  };
}

interface MoneylineLinkedIds {
  type?: string;
  home_team_id?: number;
  away_team_id?: number;
  home_label?: string;
  away_label?: string;
}

interface MoneylineMarket {
  id: string;
  week: number;
  linked_ids: MoneylineLinkedIds | null;
  selections: { id: string; label: string }[];
}

// Grades moneyline markets created via the suggestion engine (the only
// markets with linked_ids tying them to specific ESPN teams) once their
// matchup is marked final by ESPN. Leaves markets.status alone -- an admin
// still reviews and clicks "Confirm week graded" on the Grading page,
// per docs/08-odds-and-settlement.md ("Admins review and confirm before
// results show as final"). Manually-created markets (no linked_ids, or a
// selection label edited after a suggestion was accepted) are silently
// skipped and left for manual grading.
export async function autoGradeMoneylines(
  supabase: SupabaseClient,
  season: number,
): Promise<AutoGradeSummary> {
  const { data: marketsData, error: marketsError } = await supabase
    .from("markets")
    .select("id, week, linked_ids, selections(id, label)")
    .eq("season", season)
    .eq("type", "moneyline")
    .in("status", ["open", "locked"])
    .not("linked_ids", "is", null);
  if (marketsError) throw new Error(`autoGradeMoneylines markets: ${marketsError.message}`);

  const markets = (marketsData ?? []) as unknown as MoneylineMarket[];
  const changedSelectionIds: string[] = [];
  let marketsGraded = 0;

  for (const market of markets) {
    const linked = market.linked_ids;
    if (
      !linked ||
      linked.type !== "moneyline" ||
      linked.home_team_id == null ||
      linked.away_team_id == null
    ) {
      continue;
    }

    const { data: matchup, error: matchupError } = await supabase
      .from("espn_matchups")
      .select("home_score, away_score, is_final")
      .eq("season", season)
      .eq("week", market.week)
      .eq("home_team_id", linked.home_team_id)
      .eq("away_team_id", linked.away_team_id)
      .maybeSingle();
    if (matchupError) throw new Error(`autoGradeMoneylines matchup: ${matchupError.message}`);
    if (!matchup || !matchup.is_final) continue;

    const homeSelection = market.selections.find((s) => s.label === linked.home_label);
    const awaySelection = market.selections.find((s) => s.label === linked.away_label);
    if (!homeSelection || !awaySelection) continue;

    const { a: homeResult, b: awayResult } = compareTwoWay(
      matchup.home_score,
      matchup.away_score,
    );

    await updateSelectionResult(supabase, homeSelection.id, homeResult);
    await updateSelectionResult(supabase, awaySelection.id, awayResult);

    changedSelectionIds.push(homeSelection.id, awaySelection.id);
    marketsGraded++;
  }

  const betsRegraded = await regradeAffectedBets(supabase, changedSelectionIds);
  return { marketsGraded, betsRegraded };
}

interface TeamExtremesLinkedIds {
  type?: string;
  kind?: "highest" | "lowest";
  teams?: { team_id: number; label: string }[];
}

interface TeamExtremesMarket {
  id: string;
  week: number;
  linked_ids: TeamExtremesLinkedIds | null;
  selections: { id: string; label: string }[];
}

// Grades "highest/lowest scoring team" markets. Needs every matchup for
// the week to be final (not just one), since the extreme is across all
// ten teams, not a single matchup -- skips the market otherwise.
export async function autoGradeTeamExtremes(
  supabase: SupabaseClient,
  season: number,
): Promise<AutoGradeSummary> {
  const { data: marketsData, error: marketsError } = await supabase
    .from("markets")
    .select("id, week, linked_ids, selections(id, label)")
    .eq("season", season)
    .eq("type", "team_prop")
    .in("status", ["open", "locked"])
    .not("linked_ids", "is", null);
  if (marketsError) throw new Error(`autoGradeTeamExtremes markets: ${marketsError.message}`);

  const markets = (marketsData ?? []) as unknown as TeamExtremesMarket[];
  const changedSelectionIds: string[] = [];
  let marketsGraded = 0;
  const weekFinalityCache = new Map<number, Map<number, number> | null>();

  for (const market of markets) {
    const linked = market.linked_ids;
    if (!linked || linked.type !== "team_prop" || !linked.kind || !linked.teams) {
      continue;
    }

    if (!weekFinalityCache.has(market.week)) {
      weekFinalityCache.set(
        market.week,
        await buildFinalScoresByTeam(supabase, season, market.week),
      );
    }
    const scoresByTeam = weekFinalityCache.get(market.week);
    if (!scoresByTeam) continue; // week not fully final yet

    const teamIds = linked.teams.map((t) => t.team_id);
    const resultByTeamId = gradeExtreme(scoresByTeam, teamIds, linked.kind);

    for (const team of linked.teams) {
      const selection = market.selections.find((s) => s.label === team.label);
      const result = resultByTeamId.get(team.team_id);
      if (!selection || !result || result === "pending") continue;

      await updateSelectionResult(supabase, selection.id, result);
      changedSelectionIds.push(selection.id);
    }

    marketsGraded++;
  }

  const betsRegraded = await regradeAffectedBets(supabase, changedSelectionIds);
  return { marketsGraded, betsRegraded };
}

async function buildFinalScoresByTeam(
  supabase: SupabaseClient,
  season: number,
  week: number,
): Promise<Map<number, number> | null> {
  const { data: matchups, error } = await supabase
    .from("espn_matchups")
    .select("home_team_id, away_team_id, home_score, away_score, is_final")
    .eq("season", season)
    .eq("week", week);
  if (error) throw new Error(`buildFinalScoresByTeam: ${error.message}`);
  if (!matchups || matchups.length === 0) return null;
  if (matchups.some((m) => !m.is_final)) return null;

  const scores = new Map<number, number>();
  for (const m of matchups) {
    scores.set(m.home_team_id, m.home_score);
    scores.set(m.away_team_id, m.away_score);
  }
  return scores;
}

interface PlayerPropLinkedIds {
  type?: string;
  player_a_id?: number;
  player_b_id?: number;
  a_label?: string;
  b_label?: string;
  player_ids?: number[];
}

interface PlayerPropMarket {
  id: string;
  week: number;
  linked_ids: PlayerPropLinkedIds | null;
  selections: { id: string; label: string; line: number | null }[];
}

// Grades player-vs-player, combo over/under, and single-player over/under
// markets once every player involved has a final actual score for the
// week. A player who didn't play (bye/inactive) still grades once ESPN
// marks the week final -- their actual_points lands at whatever ESPN
// recorded (typically 0), matching docs/08's "default: grade as scored."
export async function autoGradePlayerProps(
  supabase: SupabaseClient,
  season: number,
): Promise<AutoGradeSummary> {
  const { data: marketsData, error: marketsError } = await supabase
    .from("markets")
    .select("id, week, linked_ids, selections(id, label, line)")
    .eq("season", season)
    .eq("type", "player_prop")
    .in("status", ["open", "locked"])
    .not("linked_ids", "is", null);
  if (marketsError) throw new Error(`autoGradePlayerProps markets: ${marketsError.message}`);

  const markets = (marketsData ?? []) as unknown as PlayerPropMarket[];
  const changedSelectionIds: string[] = [];
  let marketsGraded = 0;

  for (const market of markets) {
    const linked = market.linked_ids;
    if (!linked?.type) continue;

    if (linked.type === "player_prop_h2h") {
      if (linked.player_a_id == null || linked.player_b_id == null) continue;

      const pointsA = await getActualPoints(supabase, season, market.week, linked.player_a_id);
      const pointsB = await getActualPoints(supabase, season, market.week, linked.player_b_id);
      if (pointsA == null || pointsB == null) continue; // not final yet

      const aSelection = market.selections.find((s) => s.label === linked.a_label);
      const bSelection = market.selections.find((s) => s.label === linked.b_label);
      if (!aSelection || !bSelection) continue;

      const { a: resultA, b: resultB } = compareTwoWay(pointsA, pointsB);
      await updateSelectionResult(supabase, aSelection.id, resultA);
      await updateSelectionResult(supabase, bSelection.id, resultB);
      changedSelectionIds.push(aSelection.id, bSelection.id);
      marketsGraded++;
      continue;
    }

    if (linked.type === "player_prop_combo" || linked.type === "player_prop_single") {
      if (!linked.player_ids || linked.player_ids.length === 0) continue;

      const pointsList = await Promise.all(
        linked.player_ids.map((id) => getActualPoints(supabase, season, market.week, id)),
      );
      if (pointsList.some((p) => p == null)) continue; // not every player final yet
      const total = pointsList.reduce((sum: number, p) => sum + (p ?? 0), 0);

      const over = market.selections.find((s) => s.label.startsWith("Over"));
      const under = market.selections.find((s) => s.label.startsWith("Under"));
      if (!over || !under || over.line == null) continue;

      const { a: overResult, b: underResult } = compareTwoWay(total, over.line);
      await updateSelectionResult(supabase, over.id, overResult);
      await updateSelectionResult(supabase, under.id, underResult);
      changedSelectionIds.push(over.id, under.id);
      marketsGraded++;
    }
  }

  const betsRegraded = await regradeAffectedBets(supabase, changedSelectionIds);
  return { marketsGraded, betsRegraded };
}

async function getActualPoints(
  supabase: SupabaseClient,
  season: number,
  week: number,
  playerId: number,
): Promise<number | null> {
  const { data } = await supabase
    .from("espn_player_weeks")
    .select("actual_points")
    .eq("season", season)
    .eq("week", week)
    .eq("player_id", playerId)
    .maybeSingle();
  return data?.actual_points ?? null;
}

async function updateSelectionResult(
  supabase: SupabaseClient,
  selectionId: string,
  result: string,
) {
  const { error } = await supabase.from("selections").update({ result }).eq("id", selectionId);
  if (error) throw new Error(error.message);
}

export async function autoGradeAll(
  supabase: SupabaseClient,
  season: number,
): Promise<AutoGradeSummary> {
  const moneylines = await autoGradeMoneylines(supabase, season);
  const teamExtremes = await autoGradeTeamExtremes(supabase, season);
  const playerProps = await autoGradePlayerProps(supabase, season);
  return mergeSummaries(mergeSummaries(moneylines, teamExtremes), playerProps);
}
