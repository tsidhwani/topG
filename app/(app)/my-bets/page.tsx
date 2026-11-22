import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CancelBetButton } from "@/components/bets/cancel-bet-button";
import { PageHeading } from "@/components/page-heading";
import { BankrollChart } from "@/components/bankroll-chart";

interface BetLeg {
  id: string;
  odds_at_placement: number;
  selections: {
    label: string;
    line: number | null;
    markets: { title: string; status: string; lock_at: string | null } | null;
  } | null;
}

interface Bet {
  id: string;
  type: string;
  stake_cents: number;
  potential_payout_cents: number;
  status: string;
  placed_at: string;
  bet_legs: BetLeg[];
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function legSummary(leg: BetLeg): string {
  const label = leg.selections?.label ?? "Unknown selection";
  const line = leg.selections?.line;
  const market = leg.selections?.markets?.title;
  const odds =
    leg.odds_at_placement > 0
      ? `+${leg.odds_at_placement}`
      : `${leg.odds_at_placement}`;
  return `${market ? `${market}: ` : ""}${label}${line != null ? ` (${line})` : ""} (${odds})`;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "won") return "default";
  if (status === "lost") return "destructive";
  if (status === "open") return "secondary";
  return "outline";
}

function canStillCancel(bet: Bet): boolean {
  if (bet.status !== "open") return false;
  return bet.bet_legs.every((leg) => {
    const market = leg.selections?.markets;
    if (!market || market.status !== "open") return false;
    return !market.lock_at || new Date(market.lock_at) > new Date();
  });
}

function BetCard({ bet, stagger }: { bet: Bet; stagger: number }) {
  const net = bet.potential_payout_cents - bet.stake_cents;
  const isSettled = bet.status !== "open";

  return (
    <Card
      className="stagger-in transition-all duration-300 hover:-translate-y-0.5"
      style={{ "--stagger": `${stagger}ms` } as React.CSSProperties}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base capitalize">
          {bet.type} &mdash; ${centsToDollars(bet.stake_cents)}
        </CardTitle>
        <Badge variant={statusVariant(bet.status)}>{bet.status}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {bet.bet_legs.map((leg) => (
            <li key={leg.id}>{legSummary(leg)}</li>
          ))}
        </ul>
        <p className="text-sm">
          {isSettled ? "Payout" : "Potential payout"}: $
          {centsToDollars(bet.potential_payout_cents)}
          {isSettled && (
            <span
              className={net >= 0 ? "text-green-600" : "text-destructive"}
            >
              {" "}
              ({net >= 0 ? "+" : ""}
              {centsToDollars(net)})
            </span>
          )}
        </p>
        {canStillCancel(bet) && <CancelBetButton betId={bet.id} />}
      </CardContent>
    </Card>
  );
}

export default async function MyBetsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: betsData } = await supabase
    .from("bets")
    .select(
      "id, type, stake_cents, potential_payout_cents, status, placed_at, bet_legs(id, odds_at_placement, selections(label, line, markets(title, status, lock_at)))",
    )
    .eq("user_id", user.id)
    .order("placed_at", { ascending: false });

  const bets = (betsData ?? []) as unknown as Bet[];
  const active = bets.filter((b) => b.status === "open");
  const history = bets.filter((b) => b.status !== "open");
  const seasonNetCents = history.reduce(
    (sum, b) => sum + (b.potential_payout_cents - b.stake_cents),
    0,
  );

  // Chronological order for the chart, not the newest-first order the list uses.
  const chronological = [...history].sort(
    (a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime(),
  );
  const bankrollPoints = chronological.reduce<number[]>(
    (points, b) => [
      ...points,
      points[points.length - 1] + (b.potential_payout_cents - b.stake_cents),
    ],
    [0],
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <PageHeading
        title="My Bets"
        action={
          <p className="text-sm">
            Season P/L:{" "}
            <span
              className={
                seasonNetCents >= 0 ? "text-green-600" : "text-destructive"
              }
            >
              {seasonNetCents >= 0 ? "+" : ""}
              {centsToDollars(seasonNetCents)}
            </span>
          </p>
        }
      />

      {bankrollPoints.length > 2 && (
        <Card className="animate-fade-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Bankroll over time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BankrollChart points={bankrollPoints} />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="flex flex-col gap-3 pt-3">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active bets.</p>
          ) : (
            active.map((bet, i) => <BetCard key={bet.id} bet={bet} stagger={i * 60} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="flex flex-col gap-3 pt-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No settled bets yet.</p>
          ) : (
            history.map((bet, i) => <BetCard key={bet.id} bet={bet} stagger={i * 60} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
