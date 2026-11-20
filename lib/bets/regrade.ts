import type { SupabaseClient } from "@supabase/supabase-js";
import { gradeBet, type LegResult, type ParlayLeg } from "@/lib/odds";

interface BetWithLegs {
  id: string;
  stake_cents: number;
  bet_legs: { odds_at_placement: number; selections: { result: string } | null }[];
}

// Shared by manual grading (lib/actions/grading.ts) and ESPN auto-grading
// (lib/espn/autograde.ts). A bet regrades only once every one of its legs
// has a non-pending result (gradeBet returns "pending" otherwise, and we
// skip writing anything). Returns how many bets actually got regraded.
export async function regradeAffectedBets(
  supabase: SupabaseClient,
  selectionIds: string[],
): Promise<number> {
  if (selectionIds.length === 0) return 0;

  const { data: legs, error: legsError } = await supabase
    .from("bet_legs")
    .select("bet_id")
    .in("selection_id", selectionIds);
  if (legsError) throw new Error(legsError.message);

  const betIds = [...new Set((legs ?? []).map((l) => l.bet_id))];
  if (betIds.length === 0) return 0;

  const { data: betsData, error: betsError } = await supabase
    .from("bets")
    .select("id, stake_cents, bet_legs(odds_at_placement, selections(result))")
    .in("id", betIds)
    .eq("status", "open");
  if (betsError) throw new Error(betsError.message);

  const bets = (betsData ?? []) as unknown as BetWithLegs[];
  let regraded = 0;

  for (const bet of bets) {
    const legs: ParlayLeg[] = bet.bet_legs.map((l) => ({
      odds: l.odds_at_placement,
      result: (l.selections?.result ?? "pending") as LegResult,
    }));
    const graded = gradeBet(legs, bet.stake_cents);
    if (graded.status === "pending") continue;

    const { error } = await supabase
      .from("bets")
      .update({
        status: graded.status,
        potential_payout_cents: graded.payoutCents,
      })
      .eq("id", bet.id);
    if (error) throw new Error(error.message);
    regraded++;
  }

  return regraded;
}
