"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function markUserWeekSettled(userId: string, betIds: string[]) {
  await requireAdmin();
  if (betIds.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("bets")
    .update({ settled: true, settled_at: new Date().toISOString() })
    .in("id", betIds)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/settlement");
}
