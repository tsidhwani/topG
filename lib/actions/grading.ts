"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { gradeBet, type LegResult, type ParlayLeg } from "@/lib/odds";

const VALID_RESULTS = new Set(["pending", "win", "loss", "push", "void"]);

interface BetWithLegs {
  id: string;
  stake_cents: number;
  bet_legs: { odds_at_placement: number; selections: { result: string } | null }[];
}

export async function saveGrades(
  season: number,
  week: number,
  results: Record<string, string>,
) {
  await requireAdmin();
  const supabase = await createClient();

  const entries = Object.entries(results).filter(([, v]) => VALID_RESULTS.has(v));
  if (entries.length === 0) return;

  for (const [selectionId, result] of entries) {
    const { error } = await supabase
      .from("selections")
      .update({ result })
      .eq("id", selectionId);
    if (error) throw new Error(error.message);
  }

  await regradeAffectedBets(
    supabase,
    entries.map(([id]) => id),
  );

  revalidatePath("/admin/grading");
  revalidatePath("/");
  revalidatePath("/my-bets");
}

// A bet regrades only once every one of its legs has a non-pending result
// (gradeBet returns "pending" otherwise, and we skip writing anything).
async function regradeAffectedBets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  selectionIds: string[],
) {
  const { data: legs, error: legsError } = await supabase
    .from("bet_legs")
    .select("bet_id")
    .in("selection_id", selectionIds);
  if (legsError) throw new Error(legsError.message);

  const betIds = [...new Set((legs ?? []).map((l) => l.bet_id))];
  if (betIds.length === 0) return;

  const { data: betsData, error: betsError } = await supabase
    .from("bets")
    .select("id, stake_cents, bet_legs(odds_at_placement, selections(result))")
    .in("id", betIds)
    .eq("status", "open");
  if (betsError) throw new Error(betsError.message);

  const bets = (betsData ?? []) as unknown as BetWithLegs[];

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
  }
}

export async function confirmWeekGraded(season: number, week: number) {
  await requireAdmin();
  const supabase = await createClient();

  const { error: marketsError } = await supabase
    .from("markets")
    .update({ status: "graded" })
    .eq("season", season)
    .eq("week", week)
    .in("status", ["open", "locked"]);
  if (marketsError) throw new Error(marketsError.message);

  const { error: weekError } = await supabase
    .from("weeks")
    .update({ status: "graded" })
    .eq("season", season)
    .eq("week", week);
  if (weekError) throw new Error(weekError.message);

  revalidatePath("/admin/grading");
  revalidatePath("/");
}
