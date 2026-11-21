// Proves admin-only data actually can't be read by a non-admin, not just
// hidden in the UI. Run with:
//   npx tsx --env-file=.env.local scripts/verify-admin-lockdown.ts
//
// This checks the layer that actually matters (RLS, confirmed empirically
// against a real signed-in non-admin session) rather than assuming the UI
// hiding something means the data is safe. The other two layers the admin
// side relies on are structural, not per-route, so they're verified by
// inspection instead of a brittle live simulation:
//   - Every admin server action starts with `await requireAdmin()`
//     (lib/auth.ts) before touching the database.
//   - Every /admin/* route sits under app/(app)/admin/layout.tsx, which
//     redirects non-admins before any nested page renders -- one gate for
//     every current and future admin route, not copy-pasted per page.
//
// Creates and deletes its own throwaway non-admin user; touches no real
// league data.

import { createClient } from "@supabase/supabase-js";

const ADMIN_ONLY_TABLES = ["suggestions", "league_state"] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const testEmail = `lockdown-check-${Date.now()}@example.com`;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: testEmail,
  });
  if (linkErr) throw linkErr;

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verifyData, error: verifyErr } = await userClient.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });
  if (verifyErr) throw verifyErr;
  if (!verifyData.user) throw new Error("verifyOtp returned no user");
  const testUserId = verifyData.user.id;

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", testUserId)
    .single();

  if (profile?.role !== "user") {
    throw new Error(`FAIL: expected throwaway test user to default to 'user', got '${profile?.role}'`);
  }
  console.log(`Signed in as a confirmed non-admin (role='${profile?.role}').\n`);

  let failures = 0;

  for (const table of ADMIN_ONLY_TABLES) {
    const { data, error } = await userClient.from(table).select("*").limit(1);
    // RLS silently filters rows rather than erroring -- 0 rows is the pass
    // condition, same as a real query would see.
    if (error) {
      console.log(`[WARN] ${table}: query errored (${error.message}) -- check it still exists`);
    } else if ((data?.length ?? 0) > 0) {
      console.log(`[FAIL] ${table}: non-admin got ${data!.length} row(s) back`);
      failures++;
    } else {
      console.log(`[PASS] ${table}: non-admin reads 0 rows`);
    }
  }

  await admin.from("profiles").delete().eq("id", testUserId);
  await admin.auth.admin.deleteUser(testUserId);
  console.log("\nCleaned up throwaway test user.");

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED.`);
    process.exitCode = 1;
  } else {
    console.log("\nAll RLS lockdown checks passed.");
  }
}

main().catch((err) => {
  console.error("Script error:", err.message);
  process.exitCode = 1;
});
