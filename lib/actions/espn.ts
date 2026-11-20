"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncAll, type SyncSummary } from "@/lib/espn/sync";

export async function syncEspnNow(): Promise<SyncSummary> {
  await requireAdmin();
  const admin = createAdminClient();
  const summary = await syncAll(admin);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/lines");

  return summary;
}
