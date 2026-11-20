import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, espn_team_id, venmo_handle")
    .eq("id", user.id)
    .single();

  return profile ? { user, profile } : null;
}

export async function requireAdmin() {
  const current = await getCurrentProfile();
  if (!current || current.profile.role !== "admin") {
    throw new Error("Admins only");
  }
  return current;
}
