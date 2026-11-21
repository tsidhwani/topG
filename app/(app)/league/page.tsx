import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <PageHeading title="League" />

      <Tabs defaultValue="standings">
        <TabsList>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="leaderboard">Bettor Leaderboard</TabsTrigger>
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
      </Tabs>
    </div>
  );
}
