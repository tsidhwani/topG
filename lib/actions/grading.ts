"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { regradeAffectedBets } from "@/lib/bets/regrade";

const VALID_RESULTS = new Set(["pending", "win", "loss", "push", "void"]);

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
