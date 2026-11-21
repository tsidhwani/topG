"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function originFromHeaders(headersList: Headers): string {
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

// Any email works — there's no league-member registry to maintain. A
// profile (role 'user' by default) is created automatically on first
// sign-in, which is all a regular user needs: placing bets and seeing
// their own history.
export async function sendMagicLink(email: string): Promise<{ error?: string }> {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return { error: "Enter a valid email." };
  }

  const origin = originFromHeaders(await headers());
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

// Admin access stays gated to the handful of emails in allowed_emails
// (just Tapan/Kyle/Will). Sends the same kind of magic link, but tagged
// so /auth/callback knows to check the allowlist and promote the profile
// to admin on arrival — see that route for the actual promotion.
export async function requestAdminAccess(email: string): Promise<{ error?: string }> {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    return { error: "Enter a valid email." };
  }

  const admin = createAdminClient();
  const { data: allowed } = await admin
    .from("allowed_emails")
    .select("is_admin")
    .ilike("email", normalized)
    .maybeSingle();

  if (!allowed?.is_admin) {
    return { error: "That email isn't authorized for admin access." };
  }

  const origin = originFromHeaders(await headers());
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: { emailRedirectTo: `${origin}/auth/callback?mode=admin` },
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
