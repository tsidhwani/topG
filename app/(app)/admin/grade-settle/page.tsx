import { createClient } from "@/lib/supabase/server";
import { getCurrentWeek } from "@/lib/weeks";
import { confirmWeekGraded } from "@/lib/actions/grading";
import { markUserWeekSettled } from "@/lib/actions/settlement";
import { GradingForm } from "@/components/admin/grading-form";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Selection {
  id: string;
  label: string;
  american_odds: number;
  line: number | null;
  result: string;
}

interface GradableMarket {
  id: string;
  title: string;
  type: string;
  status: string;
  selections: Selection[];
}

interface SettlementBetRow {
  id: string;
  user_id: string;
  stake_cents: number;
  potential_payout_cents: number;
  settled: boolean;
  bet_legs: {
    selections: { markets: { season: number; week: number } | null } | null;
  }[];
  profiles: { display_name: string; venmo_handle: string | null } | null;
}

interface UserSummary {
  name: string;
  venmo: string | null;
  staked: number;
  returned: number;
  betIds: string[];
  allSettled: boolean;
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export default async function GradeSettlePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const params = await searchParams;
  const season = Number(params.season) || new Date().getFullYear();
  const supabase = await createClient();
  const week = Number(params.week) || (await getCurrentWeek(supabase, season));

  const { data: weekRow } = await supabase
    .from("weeks")
    .select("season, week, status")
    .eq("season", season)
    .eq("week", week)
    .maybeSingle();

  const { data: marketsData } = await supabase
    .from("markets")
    .select("id, title, type, status, selections(id, label, american_odds, line, result)")
    .eq("season", season)
    .eq("week", week)
    .in("status", ["open", "locked"])
    .order("created_at", { ascending: true });
  const markets = (marketsData ?? []) as unknown as GradableMarket[];
  const hasPending = markets.some((m) => m.selections.some((s) => s.result === "pending"));

  const { data: betsData } = await supabase
    .from("bets")
    .select(
      "id, user_id, stake_cents, potential_payout_cents, settled, bet_legs(selections(markets(season, week))), profiles(display_name, venmo_handle)",
    )
    .neq("status", "open");
  const bets = (betsData ?? []) as unknown as SettlementBetRow[];
  const weekBets = bets.filter(
    (b) =>
      b.bet_legs.length > 0 &&
      b.bet_legs.every(
        (l) =>
          l.selections?.markets?.season === season &&
          l.selections?.markets?.week === week,
      ),
  );
  const byUser = new Map<string, UserSummary>();
  for (const bet of weekBets) {
    const entry = byUser.get(bet.user_id) ?? {
      name: bet.profiles?.display_name ?? "Unknown",
      venmo: bet.profiles?.venmo_handle ?? null,
      staked: 0,
      returned: 0,
      betIds: [],
      allSettled: true,
    };
    entry.staked += bet.stake_cents;
    entry.returned += bet.potential_payout_cents;
    entry.betIds.push(bet.id);
    entry.allSettled = entry.allSettled && bet.settled;
    byUser.set(bet.user_id, entry);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <PageHeading title="Grade & Settle" tagline="Good Lines, Better People" />

      <form className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="season">Season</Label>
          <Input id="season" name="season" type="number" defaultValue={season} className="w-28" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="week">Week</Label>
          <Input id="week" name="week" type="number" defaultValue={week} className="w-20" />
        </div>
        <Button type="submit" variant="secondary">
          Switch
        </Button>
      </form>

      <Tabs defaultValue="grading">
        <TabsList>
          <TabsTrigger value="grading">Grading</TabsTrigger>
          <TabsTrigger value="settlement">Settlement</TabsTrigger>
        </TabsList>

        <TabsContent value="grading" className="flex flex-col gap-4 pt-4">
          {!weekRow ? (
            <p className="text-sm text-muted-foreground">No week found.</p>
          ) : markets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gradable markets this week.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant={weekRow.status === "graded" ? "default" : "secondary"}>
                  {weekRow.status}
                </Badge>
                <form action={confirmWeekGraded.bind(null, season, week)}>
                  <Button type="submit" disabled={hasPending || weekRow.status === "graded"}>
                    Confirm week {week} graded
                  </Button>
                </form>
              </div>
              {hasPending && (
                <p className="text-sm text-muted-foreground">
                  Some selections are still pending — set every result before
                  confirming the week.
                </p>
              )}
              <GradingForm season={season} week={week} markets={markets} />
            </>
          )}
        </TabsContent>

        <TabsContent value="settlement" className="flex flex-col gap-4 pt-4">
          {byUser.size === 0 ? (
            <p className="text-sm text-muted-foreground">No graded bets for this week yet.</p>
          ) : (
            [...byUser.entries()].map(([userId, entry]) => {
              const net = entry.returned - entry.staked;
              return (
                <Card key={userId}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">{entry.name}</CardTitle>
                    <Badge variant={entry.allSettled ? "default" : "secondary"}>
                      {entry.allSettled ? "settled" : "unsettled"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    <p>Staked: ${centsToDollars(entry.staked)}</p>
                    <p>Returned: ${centsToDollars(entry.returned)}</p>
                    <p className={net >= 0 ? "text-green-600" : "text-destructive"}>
                      {net >= 0 ? "Top G owes" : "Owes Top G"}: $
                      {centsToDollars(Math.abs(net))}
                    </p>
                    {entry.venmo && (
                      <p className="text-muted-foreground">Venmo: {entry.venmo}</p>
                    )}
                    {!entry.allSettled && (
                      <form action={markUserWeekSettled.bind(null, userId, entry.betIds)}>
                        <Button type="submit" size="sm">
                          Mark {entry.name.split(" ")[0]}&apos;s week settled
                        </Button>
                      </form>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
