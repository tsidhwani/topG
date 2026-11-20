import type { SupabaseClient } from "@supabase/supabase-js";
import { regradeAffectedBets } from "@/lib/bets/regrade";

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

export interface AutoGradeSummary {
  marketsGraded: number;
  betsRegraded: number;
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

    let homeResult: string;
    let awayResult: string;
    if (matchup.home_score > matchup.away_score) {
      homeResult = "win";
      awayResult = "loss";
    } else if (matchup.away_score > matchup.home_score) {
      homeResult = "loss";
      awayResult = "win";
    } else {
      homeResult = "push";
      awayResult = "push";
    }

    const { error: homeUpdateError } = await supabase
      .from("selections")
      .update({ result: homeResult })
      .eq("id", homeSelection.id);
    if (homeUpdateError) throw new Error(homeUpdateError.message);

    const { error: awayUpdateError } = await supabase
      .from("selections")
      .update({ result: awayResult })
      .eq("id", awaySelection.id);
    if (awayUpdateError) throw new Error(awayUpdateError.message);

    changedSelectionIds.push(homeSelection.id, awaySelection.id);
    marketsGraded++;
  }

  const betsRegraded = await regradeAffectedBets(supabase, changedSelectionIds);

  return { marketsGraded, betsRegraded };
}
