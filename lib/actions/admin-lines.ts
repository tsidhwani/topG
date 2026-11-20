"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function upsertWeek(formData: FormData) {
  await requireAdmin();

  const season = Number(formData.get("season"));
  const week = Number(formData.get("week"));
  const lockAtRaw = formData.get("lock_at");
  const lockAt =
    typeof lockAtRaw === "string" && lockAtRaw
      ? new Date(lockAtRaw).toISOString()
      : null;

  if (!Number.isInteger(season) || !Number.isInteger(week)) {
    throw new Error("Season and week must be numbers");
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("weeks")
    .select("season")
    .eq("season", season)
    .eq("week", week)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("weeks")
        .update({ lock_at: lockAt })
        .eq("season", season)
        .eq("week", week)
    : await supabase
        .from("weeks")
        .insert({ season, week, lock_at: lockAt, status: "draft" });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/lines");
}

export interface SelectionInput {
  label: string;
  americanOdds: number;
  line: number | null;
}

export interface CreateMarketInput {
  season: number;
  week: number;
  type: string;
  title: string;
  description: string | null;
  lockAt: string | null;
  selections: SelectionInput[];
}

export async function createMarket(input: CreateMarketInput) {
  const { user } = await requireAdmin();
  const supabase = await createClient();

  if (!input.title.trim()) {
    throw new Error("Title is required");
  }
  if (input.selections.length === 0) {
    throw new Error("Add at least one selection");
  }
  for (const selection of input.selections) {
    if (!selection.label.trim()) {
      throw new Error("Every selection needs a label");
    }
    if (!selection.americanOdds || Number.isNaN(selection.americanOdds)) {
      throw new Error("Every selection needs nonzero odds");
    }
  }

  let lockAt = input.lockAt;
  if (!lockAt) {
    const { data: weekRow } = await supabase
      .from("weeks")
      .select("lock_at")
      .eq("season", input.season)
      .eq("week", input.week)
      .maybeSingle();
    lockAt = weekRow?.lock_at ?? null;
  }

  const { data: market, error: marketError } = await supabase
    .from("markets")
    .insert({
      season: input.season,
      week: input.week,
      type: input.type,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      lock_at: lockAt,
      created_by: user.id,
      source: "manual",
      status: "draft",
    })
    .select("id")
    .single();

  if (marketError) throw new Error(marketError.message);

  const { error: selectionsError } = await supabase.from("selections").insert(
    input.selections.map((selection) => ({
      market_id: market.id,
      label: selection.label.trim(),
      american_odds: selection.americanOdds,
      line: selection.line,
    })),
  );

  if (selectionsError) throw new Error(selectionsError.message);

  revalidatePath("/admin/lines");
}

export async function publishWeek(season: number, week: number) {
  await requireAdmin();
  const supabase = await createClient();

  const { error: marketsError } = await supabase
    .from("markets")
    .update({ status: "open" })
    .eq("season", season)
    .eq("week", week)
    .eq("status", "draft");

  if (marketsError) throw new Error(marketsError.message);

  const { error: weekError } = await supabase
    .from("weeks")
    .update({ status: "open", lines_publish_at: new Date().toISOString() })
    .eq("season", season)
    .eq("week", week);

  if (weekError) throw new Error(weekError.message);

  revalidatePath("/admin/lines");
}
