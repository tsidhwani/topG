import type { SupabaseClient } from "@supabase/supabase-js";

// The week to default admin pages to when no ?week= is given: the earliest
// synced matchup that isn't final yet (the in-progress/upcoming week), or
// the latest known week if the whole synced season is already final. Reads
// only already-synced data, so it still works if ESPN itself is down.
export async function getDefaultWeek(
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
