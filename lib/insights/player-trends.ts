import type { createClient } from "@/lib/supabase/server";

export interface PlayerTrend {
  name: string;
  position: string;
  gamesPlayed: number;
  avgDiff: number;
}

const MIN_GAMES = 3;

// Average (actual - projected) points per final week, per player, across
// the season — the "beating/missing their ESPN projection" stat shown in
// League > Insights and sampled from on the Board's side rails.
export async function getPlayerTrends(
  supabase: Awaited<ReturnType<typeof createClient>>,
  season: number,
): Promise<PlayerTrend[]> {
  const { data } = await supabase
    .from("espn_player_weeks")
    .select("player_id, player_name, position, actual_points, projected_points")
    .eq("season", season)
    .eq("is_final", true)
    .not("actual_points", "is", null)
    .not("projected_points", "is", null);

  const byPlayer = new Map<number, { name: string; position: string; diffs: number[] }>();
  for (const p of data ?? []) {
    const entry = byPlayer.get(p.player_id) ?? {
      name: p.player_name,
      position: p.position,
      diffs: [] as number[],
    };
    entry.diffs.push(p.actual_points - p.projected_points);
    byPlayer.set(p.player_id, entry);
  }

  return [...byPlayer.values()]
    .filter((p) => p.diffs.length >= MIN_GAMES)
    .map((p) => ({
      name: p.name,
      position: p.position,
      gamesPlayed: p.diffs.length,
      avgDiff: p.diffs.reduce((s, d) => s + d, 0) / p.diffs.length,
    }));
}
