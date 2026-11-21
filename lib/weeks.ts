import type { SupabaseClient } from "@supabase/supabase-js";

// Single source of truth for "what week is it." Backed by league_state,
// which syncAll() keeps current from ESPN's own status.currentMatchupPeriod
// on every sync (lib/espn/sync.ts). An admin override in that same row
// takes priority when set (see Settings). Falls back to deriving a week
// from already-synced matchup finality only if league_state has no row yet
// (e.g. before the very first sync) -- keeps this resilient, never throws.
export async function getCurrentWeek(
  supabase: SupabaseClient,
  season: number,
): Promise<number> {
  const { data: state } = await supabase
    .from("league_state")
    .select("current_week, current_week_override")
    .eq("season", season)
    .maybeSingle();

  if (state) {
    return state.current_week_override ?? state.current_week;
  }

  return deriveWeekFromMatchups(supabase, season);
}

async function deriveWeekFromMatchups(
  supabase: SupabaseClient,
  season: number,
): Promise<number> {
  const { data: inProgress } = await supabase
    .from("espn_matchups")
    .select("week")
    .eq("season", season)
    .eq("is_final", false)
    .order("week", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (inProgress) return inProgress.week;

  const { data: latest } = await supabase
    .from("espn_matchups")
    .select("week")
    .eq("season", season)
    .order("week", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest?.week ?? 1;
}

export async function setCurrentWeekOverride(
  supabase: SupabaseClient,
  season: number,
  week: number | null,
): Promise<void> {
  const { error } = await supabase
    .from("league_state")
    .update({ current_week_override: week })
    .eq("season", season);
  if (error) throw new Error(error.message);
}
