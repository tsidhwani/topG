"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { setCurrentWeekOverride } from "@/lib/weeks";

export async function updateWeekOverride(week: number | null) {
  await requireAdmin();
  const supabase = await createClient();
  const season = Number(process.env.ESPN_SEASON) || new Date().getFullYear();

  await setCurrentWeekOverride(supabase, season, week);

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidatePath("/admin/lines");
  revalidatePath("/admin/grading");
  revalidatePath("/admin/settlement");
  revalidatePath("/admin/suggestions");
}
