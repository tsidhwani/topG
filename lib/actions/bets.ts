"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function placeBet(
  type: "single" | "parlay",
  stakeCents: number,
  selectionIds: string[],
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("place_bet", {
    p_type: type,
    p_stake_cents: stakeCents,
    p_selection_ids: selectionIds,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/my-bets");

  return data as string;
}
