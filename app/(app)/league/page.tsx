import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkline } from "@/components/sparkline";

interface Standing {
  espn_team_id: number;
  name: string;
  owner_name: string | null;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
}

interface BetRow {
  user_id: string;
  stake_cents: number;
  potential_payout_cents: number;
  profiles: { display_name: string } | null;
}

interface PlayerStat {
  name: string;
  position: string;
  gamesPlayed: number;
  avgDiff: number;
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default async function LeaguePage() {
  const supabase = await createClient();
  const season = Number(process.env.ESPN_SEASON) || new Date().getFullYear();

  const { data: standingsData } = await supabase
    .from("espn_teams")
    .select("espn_team_id, name, owner_name, wins, losses, ties, points_for, points_against")
    .eq("season", season)
    .order("wins", { ascending: false })
    .order("points_for", { ascending: false });
  const standings = (standingsData ?? []) as Standing[];

  const { data: betsData } = await supabase
    .from("bets")
    .select("user_id, stake_cents, potential_payout_cents, profiles(display_name)")
    .neq("status", "open");
  const bets = (betsData ?? []) as unknown as BetRow[];

  const netByUser = new Map<string, { name: string; net: number }>();
  for (const bet of bets) {
    const entry = netByUser.get(bet.user_id) ?? {
      name: bet.profiles?.display_name ?? "Unknown",
      net: 0,
    };
    entry.net += bet.potential_payout_cents - bet.stake_cents;
    netByUser.set(bet.user_id, entry);
  }
  const leaderboard = [...netByUser.values()].sort((a, b) => b.net - a.net);

  // --- Team scoring trends: every final matchup's score, per team, by week ---
  const { data: matchupsData } = await supabase
    .from("espn_matchups")
    .select("week, home_team_id, away_team_id, home_score, away_score")
    .eq("season", season)
    .eq("is_final", true)
    .order("week", { ascending: true });

  const scoresByTeam = new Map<number, number[]>();
  for (const m of matchupsData ?? []) {
    scoresByTeam.set(m.home_team_id, [...(scoresByTeam.get(m.home_team_id) ?? []), m.home_score]);
    scoresByTeam.set(m.away_team_id, [...(scoresByTeam.get(m.away_team_id) ?? []), m.away_score]);
  }

  const teamTrends = standings
    .map((s) => {
      const history = scoresByTeam.get(s.espn_team_id) ?? [];
      if (history.length === 0) return null;
      const avg = history.reduce((sum, v) => sum + v, 0) / history.length;
      const last = history[history.length - 1];
      return { name: s.name, history, avg, trendingUp: last >= avg };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  // --- Hot & cold players: avg(actual - projected) across final weeks ---
  const { data: playerWeeksData } = await supabase
    .from("espn_player_weeks")
    .select("player_id, player_name, position, actual_points, projected_points")
    .eq("season", season)
    .eq("is_final", true)
    .not("actual_points", "is", null)
    .not("projected_points", "is", null);

  const byPlayer = new Map<number, { name: string; position: string; diffs: number[] }>();
  for (const p of playerWeeksData ?? []) {
    const entry = byPlayer.get(p.player_id) ?? {
      name: p.player_name,
      position: p.position,
      diffs: [] as number[],
    };
    entry.diffs.push(p.actual_points - p.projected_points);
    byPlayer.set(p.player_id, entry);
  }

  const playerStats: PlayerStat[] = [...byPlayer.values()]
    .filter((p) => p.diffs.length >= 3)
    .map((p) => ({
      name: p.name,
      position: p.position,
      gamesPlayed: p.diffs.length,
      avgDiff: p.diffs.reduce((s, d) => s + d, 0) / p.diffs.length,
    }));

  const hotPlayers = [...playerStats].sort((a, b) => b.avgDiff - a.avgDiff).slice(0, 5);
  const coldPlayers = [...playerStats].sort((a, b) => a.avgDiff - b.avgDiff).slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <PageHeading title="League" />

      <Tabs defaultValue="standings">
        <TabsList>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="standings" className="pt-4">
          {standings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No standings yet — they show up once ESPN has been synced.
            </p>
          ) : (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Team</th>
                      <th className="px-3 py-2 font-medium">Record</th>
                      <th className="px-3 py-2 text-right font-medium">PF</th>
                      <th className="px-3 py-2 text-right font-medium">PA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s) => (
                      <tr key={s.espn_team_id} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div>{s.name}</div>
                          {s.owner_name && (
                            <div className="text-xs text-muted-foreground">
                              {s.owner_name}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {s.wins}-{s.losses}
                          {s.ties > 0 ? `-${s.ties}` : ""}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s.points_for.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s.points_against.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="pt-4">
          {leaderboard.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No settled bets yet — the leaderboard fills in once results
              start getting graded.
            </p>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4">
                {leaderboard.map((entry, i) => (
                  <div
                    key={entry.name + i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      <span className="text-muted-foreground">{i + 1}.</span>{" "}
                      {entry.name}
                    </span>
                    <span
                      className={
                        entry.net >= 0 ? "text-green-600" : "text-destructive"
                      }
                    >
                      {entry.net >= 0 ? "+" : "-"}${centsToDollars(Math.abs(entry.net))}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="flex flex-col gap-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Scoring Trends</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {teamTrends.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No final weeks synced yet.
                </p>
              ) : (
                teamTrends.map((t) => (
                  <div key={t.name} className="flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm">{t.name}</span>
                      <span className="text-xs text-muted-foreground">
                        avg {t.avg.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkline values={t.history} />
                      <Badge variant={t.trendingUp ? "default" : "secondary"}>
                        {t.trendingUp ? "↑" : "↓"}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hot Players</CardTitle>
              <p className="text-xs text-muted-foreground">
                Beating their ESPN projection by the most, on average
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {hotPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough final weeks yet.
                </p>
              ) : (
                hotPlayers.map((p) => (
                  <PlayerStatRow key={p.name} player={p} positive />
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cold Players</CardTitle>
              <p className="text-xs text-muted-foreground">
                Missing their ESPN projection by the most, on average
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {coldPlayers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not enough final weeks yet.
                </p>
              ) : (
                coldPlayers.map((p) => (
                  <PlayerStatRow key={p.name} player={p} positive={false} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlayerStatRow({ player, positive }: { player: PlayerStat; positive: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>
        {player.name}{" "}
        <span className="text-xs text-muted-foreground">
          ({player.position}, {player.gamesPlayed} games)
        </span>
      </span>
      <span className={positive ? "text-green-600" : "text-destructive"}>
        {player.avgDiff >= 0 ? "+" : ""}
        {player.avgDiff.toFixed(1)}/wk
      </span>
    </div>
  );
}
