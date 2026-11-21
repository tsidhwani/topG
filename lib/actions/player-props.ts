"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  simulateHeadToHead,
  simulateOverUnder,
  type PlayerProjection,
} from "@/lib/suggestions/player-props";
import { DEFAULT_VIG } from "@/lib/suggestions/simulate";

const SKILL_POSITIONS = new Set(["RB", "WR", "TE"]);
const CLOSE_PROJECTION_THRESHOLD = 4;

export interface EligiblePlayer {
  playerId: number;
  playerName: string;
  position: string;
  nflTeam: string;
  projectedPoints: number;
  fantasyTeamId: number;
  fantasyTeamName: string;
  injuryStatus: string | null;
}

// Rostered players only, with a real projection, not ruled OUT. Bye-week
// and inactive players naturally have a null/0 projection from ESPN, so
// filtering those out covers "skip bye/out/0-projection" in one pass.
//
// This page renders all four Lines Studio tabs in one server pass, so a
// thrown error here would take down Moneylines/Top & Bottom Scorer/Custom
// too, not just this tab — if fantasy_team_id/injury_status haven't been
// migrated in yet (migration 0008), degrade to an empty list instead.
export async function getEligiblePlayers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  season: number,
  week: number,
): Promise<EligiblePlayer[]> {
  const { data: playerRows, error } = await supabase
    .from("espn_player_weeks")
    .select("player_id, player_name, position, nfl_team, projected_points, fantasy_team_id, injury_status")
    .eq("season", season)
    .eq("week", week)
    .not("projected_points", "is", null)
    .gt("projected_points", 0)
    .not("fantasy_team_id", "is", null);
  if (error) {
    console.error("getEligiblePlayers:", error.message);
    return [];
  }

  const { data: teams, error: teamsError } = await supabase
    .from("espn_teams")
    .select("espn_team_id, name")
    .eq("season", season);
  if (teamsError) throw new Error(teamsError.message);
  const teamName = new Map((teams ?? []).map((t) => [t.espn_team_id, t.name]));

  return (playerRows ?? [])
    .filter((p) => p.injury_status !== "OUT" && p.fantasy_team_id != null)
    .map((p) => ({
      playerId: p.player_id,
      playerName: p.player_name,
      position: p.position,
      nflTeam: p.nfl_team,
      projectedPoints: p.projected_points,
      fantasyTeamId: p.fantasy_team_id as number,
      fantasyTeamName: teamName.get(p.fantasy_team_id as number) ?? "Unknown",
      injuryStatus: p.injury_status,
    }));
}

interface DraftMarketInput {
  season: number;
  week: number;
  type: "player_prop";
  title: string;
  linkedIds: Record<string, unknown>;
  selections: { label: string; americanOdds: number; line: number | null }[];
  suggestionType: string;
  payload: Record<string, unknown>;
}

async function createPlayerPropDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: DraftMarketInput,
) {
  const { data: market, error: marketError } = await supabase
    .from("markets")
    .insert({
      season: input.season,
      week: input.week,
      type: input.type,
      title: input.title,
      status: "draft",
      created_by: userId,
      source: "suggested",
      linked_ids: input.linkedIds,
    })
    .select("id")
    .single();
  if (marketError) throw new Error(marketError.message);

  const { error: selectionsError } = await supabase.from("selections").insert(
    input.selections.map((s) => ({
      market_id: market.id,
      label: s.label,
      american_odds: s.americanOdds,
      line: s.line,
    })),
  );
  if (selectionsError) throw new Error(selectionsError.message);

  const { error: suggestionError } = await supabase.from("suggestions").insert({
    season: input.season,
    week: input.week,
    type: input.suggestionType,
    payload: input.payload,
    accepted_market_id: market.id,
  });
  if (suggestionError) throw new Error(suggestionError.message);
}

async function clearStalePlayerPropDrafts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  season: number,
  week: number,
  suggestionTypePrefix: string,
) {
  const { data: staleSuggestions } = await supabase
    .from("suggestions")
    .select("accepted_market_id")
    .eq("season", season)
    .eq("week", week)
    .like("type", `${suggestionTypePrefix}%`)
    .not("accepted_market_id", "is", null);

  const marketIds = (staleSuggestions ?? []).map((s) => s.accepted_market_id);
  if (marketIds.length === 0) return;

  const { data: draftMarketIds } = await supabase
    .from("markets")
    .select("id")
    .in("id", marketIds)
    .eq("status", "draft");
  const draftIds = (draftMarketIds ?? []).map((m) => m.id);
  if (draftIds.length === 0) return;

  await supabase.from("suggestions").delete().in("accepted_market_id", draftIds);
  await supabase.from("markets").delete().in("id", draftIds);
}

export async function generateHeadToHeadProps(
  season: number,
  week: number,
  count: number,
  vig: number = DEFAULT_VIG,
  fantasyTeamFilter?: number,
) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  await clearStalePlayerPropDrafts(supabase, season, week, "player_prop_h2h");

  let players = (await getEligiblePlayers(supabase, season, week)).filter((p) =>
    SKILL_POSITIONS.has(p.position),
  );
  if (fantasyTeamFilter) {
    players = players.filter((p) => p.fantasyTeamId === fantasyTeamFilter);
  }

  const { data: matchups } = await supabase
    .from("espn_matchups")
    .select("home_team_id, away_team_id")
    .eq("season", season)
    .eq("week", week);

  const used = new Set<number>();
  const pairs: [EligiblePlayer, EligiblePlayer][] = [];

  // Prioritize: top skill player on each side of the same fantasy matchup.
  for (const m of matchups ?? []) {
    if (pairs.length >= count) break;
    const homeTop = players
      .filter((p) => p.fantasyTeamId === m.home_team_id && !used.has(p.playerId))
      .sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
    const awayTop = players
      .filter((p) => p.fantasyTeamId === m.away_team_id && !used.has(p.playerId))
      .sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
    if (homeTop && awayTop) {
      pairs.push([homeTop, awayTop]);
      used.add(homeTop.playerId);
      used.add(awayTop.playerId);
    }
  }

  // Fill remaining slots with cross-matchup pairs of similarly-projected
  // players not already used, highest combined projection first.
  if (pairs.length < count) {
    const remaining = players
      .filter((p) => !used.has(p.playerId))
      .sort((a, b) => b.projectedPoints - a.projectedPoints);

    for (let i = 0; i < remaining.length && pairs.length < count; i++) {
      if (used.has(remaining[i].playerId)) continue;
      for (let j = i + 1; j < remaining.length; j++) {
        if (used.has(remaining[j].playerId)) continue;
        if (
          Math.abs(remaining[i].projectedPoints - remaining[j].projectedPoints) <=
          CLOSE_PROJECTION_THRESHOLD
        ) {
          pairs.push([remaining[i], remaining[j]]);
          used.add(remaining[i].playerId);
          used.add(remaining[j].playerId);
          break;
        }
      }
    }
  }

  for (const [a, b] of pairs) {
    const sim = simulateHeadToHead(
      { playerId: a.playerId, position: a.position, projected: a.projectedPoints },
      { playerId: b.playerId, position: b.position, projected: b.projectedPoints },
      vig,
    );

    await createPlayerPropDraft(supabase, user.id, {
      season,
      week,
      type: "player_prop",
      title: `${a.playerName} vs ${b.playerName}`,
      linkedIds: {
        type: "player_prop_h2h",
        player_a_id: a.playerId,
        player_b_id: b.playerId,
        a_label: `${a.playerName} to outscore ${b.playerName}`,
        b_label: `${b.playerName} to outscore ${a.playerName}`,
      },
      selections: [
        {
          label: `${a.playerName} to outscore ${b.playerName}`,
          americanOdds: sim.playerAOdds,
          line: null,
        },
        {
          label: `${b.playerName} to outscore ${a.playerName}`,
          americanOdds: sim.playerBOdds,
          line: null,
        },
      ],
      suggestionType: "player_prop_h2h",
      payload: {
        player_a: { id: a.playerId, name: a.playerName, projected: a.projectedPoints },
        player_b: { id: b.playerId, name: b.playerName, projected: b.projectedPoints },
        player_a_win_probability: sim.playerAWinProbability,
        fair_odds: { a: sim.playerAFairOdds, b: sim.playerBFairOdds },
        suggested_odds: { a: sim.playerAOdds, b: sim.playerBOdds },
        vig,
      },
    });
  }

  revalidatePath("/admin/lines-studio");
  return pairs.length;
}

export async function generateComboProps(
  season: number,
  week: number,
  count: number,
  vig: number = DEFAULT_VIG,
  fantasyTeamFilter?: number,
) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  await clearStalePlayerPropDrafts(supabase, season, week, "player_prop_combo");

  let players = (await getEligiblePlayers(supabase, season, week)).filter((p) =>
    SKILL_POSITIONS.has(p.position),
  );
  if (fantasyTeamFilter) {
    players = players.filter((p) => p.fantasyTeamId === fantasyTeamFilter);
  }

  const byTeam = new Map<number, EligiblePlayer[]>();
  for (const p of players) {
    const list = byTeam.get(p.fantasyTeamId) ?? [];
    list.push(p);
    byTeam.set(p.fantasyTeamId, list);
  }

  const teamCombos = [...byTeam.entries()]
    .map(([teamId, teamPlayers]) => {
      const top3 = teamPlayers
        .sort((a, b) => b.projectedPoints - a.projectedPoints)
        .slice(0, 3);
      return { teamId, players: top3 };
    })
    .filter((c) => c.players.length >= 2)
    .sort(
      (a, b) =>
        b.players.reduce((s, p) => s + p.projectedPoints, 0) -
        a.players.reduce((s, p) => s + p.projectedPoints, 0),
    )
    .slice(0, count);

  for (const combo of teamCombos) {
    const sim = simulateOverUnder(
      combo.players.map((p): PlayerProjection => ({
        playerId: p.playerId,
        position: p.position,
        projected: p.projectedPoints,
      })),
      vig,
    );
    const names = combo.players.map((p) => p.playerName).join(" + ");
    const title = `${names} combined over/under`;

    await createPlayerPropDraft(supabase, user.id, {
      season,
      week,
      type: "player_prop",
      title,
      linkedIds: {
        type: "player_prop_combo",
        player_ids: combo.players.map((p) => p.playerId),
      },
      selections: [
        { label: `Over ${sim.line}`, americanOdds: sim.overOdds, line: sim.line },
        { label: `Under ${sim.line}`, americanOdds: sim.underOdds, line: sim.line },
      ],
      suggestionType: "player_prop_combo",
      payload: {
        players: combo.players.map((p) => ({
          id: p.playerId,
          name: p.playerName,
          projected: p.projectedPoints,
        })),
        line: sim.line,
        over_probability: sim.overProbability,
        fair_odds: { over: sim.overFairOdds, under: sim.underFairOdds },
        suggested_odds: { over: sim.overOdds, under: sim.underOdds },
        vig,
      },
    });
  }

  revalidatePath("/admin/lines-studio");
  return teamCombos.length;
}

export async function generateSinglePlayerProps(
  season: number,
  week: number,
  count: number,
  vig: number = DEFAULT_VIG,
  fantasyTeamFilter?: number,
) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  await clearStalePlayerPropDrafts(supabase, season, week, "player_prop_single");

  let players = await getEligiblePlayers(supabase, season, week);
  if (fantasyTeamFilter) {
    players = players.filter((p) => p.fantasyTeamId === fantasyTeamFilter);
  }

  const top = players
    .sort((a, b) => b.projectedPoints - a.projectedPoints)
    .slice(0, count);

  for (const p of top) {
    const sim = simulateOverUnder(
      [{ playerId: p.playerId, position: p.position, projected: p.projectedPoints }],
      vig,
    );
    const title = `${p.playerName} fantasy points`;

    await createPlayerPropDraft(supabase, user.id, {
      season,
      week,
      type: "player_prop",
      title,
      linkedIds: { type: "player_prop_single", player_id: p.playerId },
      selections: [
        { label: `Over ${sim.line}`, americanOdds: sim.overOdds, line: sim.line },
        { label: `Under ${sim.line}`, americanOdds: sim.underOdds, line: sim.line },
      ],
      suggestionType: "player_prop_single",
      payload: {
        player: { id: p.playerId, name: p.playerName, projected: p.projectedPoints },
        line: sim.line,
        over_probability: sim.overProbability,
        fair_odds: { over: sim.overFairOdds, under: sim.underFairOdds },
        suggested_odds: { over: sim.overOdds, under: sim.underOdds },
        vig,
      },
    });
  }

  revalidatePath("/admin/lines-studio");
  return top.length;
}

export async function createCustomHeadToHead(
  season: number,
  week: number,
  playerAId: number,
  playerBId: number,
  vig: number = DEFAULT_VIG,
) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  const players = await getEligiblePlayers(supabase, season, week);
  const a = players.find((p) => p.playerId === playerAId);
  const b = players.find((p) => p.playerId === playerBId);
  if (!a || !b) throw new Error("player not found or not eligible this week");

  const sim = simulateHeadToHead(
    { playerId: a.playerId, position: a.position, projected: a.projectedPoints },
    { playerId: b.playerId, position: b.position, projected: b.projectedPoints },
    vig,
  );

  await createPlayerPropDraft(supabase, user.id, {
    season,
    week,
    type: "player_prop",
    title: `${a.playerName} vs ${b.playerName}`,
    linkedIds: {
      type: "player_prop_h2h",
      player_a_id: a.playerId,
      player_b_id: b.playerId,
      a_label: `${a.playerName} to outscore ${b.playerName}`,
      b_label: `${b.playerName} to outscore ${a.playerName}`,
    },
    selections: [
      {
        label: `${a.playerName} to outscore ${b.playerName}`,
        americanOdds: sim.playerAOdds,
        line: null,
      },
      {
        label: `${b.playerName} to outscore ${a.playerName}`,
        americanOdds: sim.playerBOdds,
        line: null,
      },
    ],
    suggestionType: "player_prop_h2h",
    payload: {
      player_a: { id: a.playerId, name: a.playerName, projected: a.projectedPoints },
      player_b: { id: b.playerId, name: b.playerName, projected: b.projectedPoints },
      player_a_win_probability: sim.playerAWinProbability,
      fair_odds: { a: sim.playerAFairOdds, b: sim.playerBFairOdds },
      suggested_odds: { a: sim.playerAOdds, b: sim.playerBOdds },
      vig,
    },
  });

  revalidatePath("/admin/lines-studio");
}

export async function createCustomCombo(
  season: number,
  week: number,
  playerIds: number[],
  vig: number = DEFAULT_VIG,
) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  if (playerIds.length < 2 || playerIds.length > 3) {
    throw new Error("combo props need 2 or 3 players");
  }

  const players = await getEligiblePlayers(supabase, season, week);
  const chosen = playerIds.map((id) => {
    const p = players.find((pl) => pl.playerId === id);
    if (!p) throw new Error(`player ${id} not found or not eligible this week`);
    return p;
  });

  const sim = simulateOverUnder(
    chosen.map((p): PlayerProjection => ({
      playerId: p.playerId,
      position: p.position,
      projected: p.projectedPoints,
    })),
    vig,
  );
  const names = chosen.map((p) => p.playerName).join(" + ");

  await createPlayerPropDraft(supabase, user.id, {
    season,
    week,
    type: "player_prop",
    title: `${names} combined over/under`,
    linkedIds: { type: "player_prop_combo", player_ids: chosen.map((p) => p.playerId) },
    selections: [
      { label: `Over ${sim.line}`, americanOdds: sim.overOdds, line: sim.line },
      { label: `Under ${sim.line}`, americanOdds: sim.underOdds, line: sim.line },
    ],
    suggestionType: "player_prop_combo",
    payload: {
      players: chosen.map((p) => ({ id: p.playerId, name: p.playerName, projected: p.projectedPoints })),
      line: sim.line,
      over_probability: sim.overProbability,
      fair_odds: { over: sim.overFairOdds, under: sim.underFairOdds },
      suggested_odds: { over: sim.overOdds, under: sim.underOdds },
      vig,
    },
  });

  revalidatePath("/admin/lines-studio");
}
