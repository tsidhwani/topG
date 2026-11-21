import { createClient } from "@/lib/supabase/server";
import { SyncNowButton } from "@/components/admin/sync-now-button";
import { WeekOverride } from "@/components/admin/week-override";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const season = Number(process.env.ESPN_SEASON) || new Date().getFullYear();

  const { data: lastSync } = await supabase
    .from("espn_teams")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: teamCount } = await supabase
    .from("espn_teams")
    .select("*", { count: "exact", head: true });

  const { data: leagueState } = await supabase
    .from("league_state")
    .select("current_week, current_week_override")
    .eq("season", season)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6">
      <PageHeading title="Admin Settings" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ESPN sync</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">League</span>
            <span>
              {process.env.ESPN_LEAGUE_ID} (season {process.env.ESPN_SEASON})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Last synced</span>
            <span>
              {lastSync?.synced_at
                ? new Date(lastSync.synced_at).toLocaleString()
                : "never"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Teams synced</span>
            <Badge variant={teamCount ? "default" : "secondary"}>
              {teamCount ?? 0}
            </Badge>
          </div>
          <SyncNowButton />
          <p className="text-xs text-muted-foreground">
            Runs automatically Tuesday and Wednesday mornings. If a sync
            fails with an auth-looking error, the espn_s2/SWID cookies have
            probably expired — grab fresh ones from a logged-in browser
            session and update them in Vercel&apos;s environment variables.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current week</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">ESPN says</span>
            <Badge>{leagueState?.current_week ?? "unknown — sync first"}</Badge>
          </div>
          {leagueState && (
            <WeekOverride
              currentWeek={leagueState.current_week}
              override={leagueState.current_week_override}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Every page (Board, Lines Studio, Grade &amp; Settle) uses this
            week unless you override it here — useful right when a new
            season rolls over, or if ESPN is briefly wrong.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
