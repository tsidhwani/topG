import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAllMatchups,
  getLeagueStatus,
  getTeams,
  getWeekBoxscore,
} from "./client";
import { autoGradeMoneylines } from "./autograde";

function season(): number {
  return Number(process.env.ESPN_SEASON);
}

export async function syncTeams(supabase: SupabaseClient) {
  const teams = await getTeams();
  const yr = season();

  const { error } = await supabase.from("espn_teams").upsert(
    teams.map((t) => ({
      season: yr,
      espn_team_id: t.espnTeamId,
      name: t.name,
      owner_name: t.ownerName,
      wins: t.wins,
      losses: t.losses,
      ties: t.ties,
      points_for: t.pointsFor,
      points_against: t.pointsAgainst,
      synced_at: new Date().toISOString(),
    })),
    { onConflict: "season,espn_team_id" },
  );
  if (error) throw new Error(`syncTeams: ${error.message}`);

  return teams.length;
}

export async function syncMatchups(supabase: SupabaseClient) {
  const matchups = await getAllMatchups();
  const yr = season();

  const { error } = await supabase.from("espn_matchups").upsert(
    matchups.map((m) => ({
      season: yr,
      week: m.week,
      home_team_id: m.homeTeamId,
      away_team_id: m.awayTeamId,
      home_score: m.homeScore,
      away_score: m.awayScore,
      is_final: m.isFinal,
      synced_at: new Date().toISOString(),
    })),
    { onConflict: "season,week,home_team_id,away_team_id" },
  );
  if (error) throw new Error(`syncMatchups: ${error.message}`);

  return matchups.length;
}

export async function syncWeekBoxscore(supabase: SupabaseClient, week: number) {
  const { players, teamProjectedTotals } = await getWeekBoxscore(week);
  const yr = season();

  if (players.length > 0) {
    const { error: playersError } = await supabase.from("espn_player_weeks").upsert(
      players.map((p) => ({
        season: yr,
        week,
        player_id: p.playerId,
        player_name: p.playerName,
        nfl_team: p.nflTeam,
        position: p.position,
        projected_points: p.projectedPoints,
        actual_points: p.actualPoints,
        is_final: p.actualPoints != null,
      })),
      { onConflict: "season,week,player_id" },
    );
    if (playersError) throw new Error(`syncWeekBoxscore players: ${playersError.message}`);
  }

  for (const [teamId, projected] of Object.entries(teamProjectedTotals)) {
    // teamId could be either side of a given matchup row for this week, so
    // update whichever column it actually matches rather than assuming home.
    const { error: homeErr } = await supabase
      .from("espn_matchups")
      .update({ home_projected: projected })
      .eq("season", yr)
      .eq("week", week)
      .eq("home_team_id", Number(teamId));
    if (homeErr) throw new Error(`syncWeekBoxscore home_projected: ${homeErr.message}`);

    const { error: awayErr } = await supabase
      .from("espn_matchups")
      .update({ away_projected: projected })
      .eq("season", yr)
      .eq("week", week)
      .eq("away_team_id", Number(teamId));
    if (awayErr) throw new Error(`syncWeekBoxscore away_projected: ${awayErr.message}`);
  }

  return players.length;
}

export interface SyncSummary {
  teams: number;
  matchups: number;
  currentWeek: number;
  weeksSynced: number[];
  playerWeeksSynced: number;
  marketsAutoGraded: number;
  betsRegraded: number;
  syncedAt: string;
}

// Syncs teams, the full season's matchup scores, and player boxscores for
// the current week plus the previous one (covers "upcoming week projections"
// and "just-finished week actuals" without re-fetching every past week on
// every run), then auto-grades any suggestion-engine moneyline markets
// whose matchup just went final.
export async function syncAll(supabase: SupabaseClient): Promise<SyncSummary> {
  const status = await getLeagueStatus();
  const yr = season();

  const { error: stateError } = await supabase.from("league_state").upsert(
    { season: yr, current_week: status.currentMatchupPeriod, synced_at: new Date().toISOString() },
    { onConflict: "season" },
  );
  if (stateError) throw new Error(`syncAll league_state: ${stateError.message}`);

  const teams = await syncTeams(supabase);
  const matchups = await syncMatchups(supabase);

  const weeksToSync = [status.currentMatchupPeriod];
  if (status.currentMatchupPeriod > status.firstScoringPeriod) {
    weeksToSync.push(status.currentMatchupPeriod - 1);
  }

  let playerWeeksSynced = 0;
  for (const week of weeksToSync) {
    playerWeeksSynced += await syncWeekBoxscore(supabase, week);
  }

  const { marketsGraded, betsRegraded } = await autoGradeMoneylines(
    supabase,
    Number(process.env.ESPN_SEASON),
  );

  return {
    teams,
    matchups,
    currentWeek: status.currentMatchupPeriod,
    weeksSynced: weeksToSync,
    playerWeeksSynced,
    marketsAutoGraded: marketsGraded,
    betsRegraded,
    syncedAt: new Date().toISOString(),
  };
}
