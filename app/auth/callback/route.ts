import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const mode = searchParams.get("mode");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (mode === "admin") {
        await maybePromoteToAdmin(supabase);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

// Re-checks the allowlist at the point of actually granting admin, rather
// than trusting the earlier check in requestAdminAccess() — the link could
// sit in an inbox for a while before being clicked.
async function maybePromoteToAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return;

  const admin = createAdminClient();
  const { data: allowed } = await admin
    .from("allowed_emails")
    .select("is_admin")
    .ilike("email", user.email)
    .maybeSingle();

  if (allowed?.is_admin) {
    await admin.from("profiles").update({ role: "admin" }).eq("id", user.id);
  }
}
