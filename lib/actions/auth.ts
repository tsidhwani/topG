"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function sendMagicLink(email: string): Promise<{ error?: string }> {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return { error: "Enter a valid email." };
  }

  // Checked here, server-side, before Supabase ever sees the email —
  // signInWithOtp with shouldCreateUser would otherwise let anyone sign up.
  const admin = createAdminClient();
  const { data: allowed } = await admin
    .from("allowed_emails")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();

  if (!allowed) {
    return {
      error: "That email isn't on the league list yet. Ask an admin to add you.",
    };
  }

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: `${protocol}://${host}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
