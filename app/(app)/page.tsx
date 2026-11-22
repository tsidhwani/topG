import { createClient } from "@/lib/supabase/server";
import { getCurrentWeek } from "@/lib/weeks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BetSlipProvider } from "@/components/betslip/bet-slip-context";
import { SelectionButton } from "@/components/betslip/selection-button";
import { BetSlipDrawer } from "@/components/betslip/bet-slip-drawer";
import { LockCountdown } from "@/components/lock-countdown";
import { PageHeading } from "@/components/page-heading";

interface Selection {
  id: string;
  label: string;
  american_odds: number;
  line: number | null;
}

interface Market {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  lock_at: string | null;
  selections: Selection[];
}

const MATCHUP_TYPES = new Set(["moneyline", "spread", "total"]);

function groupMarkets(markets: Market[]) {
  return {
    matchups: markets.filter((m) => MATCHUP_TYPES.has(m.type)),
    props: markets.filter((m) => m.type === "player_prop"),
    futures: markets.filter((m) => m.type === "future"),
  };
}

function MarketCard({ market, stagger }: { market: Market; stagger: number }) {
  return (
    <Card
      className="stagger-in transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_32px_-8px_var(--primary)]"
      style={{ "--stagger": `${stagger}ms` } as React.CSSProperties}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{market.title}</CardTitle>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={market.status === "open" ? "default" : "secondary"}>
            {market.status}
          </Badge>
          {market.lock_at && <LockCountdown lockAt={market.lock_at} />}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {market.description && (
          <p className="text-sm text-muted-foreground">{market.description}</p>
        )}
        {market.selections.map((s) => (
          <SelectionButton
            key={s.id}
            selection={{
              id: s.id,
              label: s.label,
              americanOdds: s.american_odds,
              line: s.line,
              marketTitle: market.title,
            }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default async function ThisWeekPage() {
  const supabase = await createClient();
  const season = Number(process.env.ESPN_SEASON) || new Date().getFullYear();
  const week = await getCurrentWeek(supabase, season);

  const { data: weekRow } = await supabase
    .from("weeks")
    .select("season, week, status, lock_at")
    .eq("season", season)
    .eq("week", week)
    .maybeSingle();

  const { data: openMarketsData } = await supabase
    .from("markets")
    .select("id")
    .eq("season", season)
    .eq("week", week)
    .in("status", ["open", "locked"])
    .limit(1);

  if (!weekRow || !openMarketsData || openMarketsData.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 p-6 pt-24 text-center">
        <h1 className="font-heading text-3xl text-primary">
          Week {week} lines aren&apos;t up yet
        </h1>
        <p className="text-sm text-muted-foreground">
          Lines usually drop Wednesday morning — check back then, or ping an
          admin if it&apos;s later than that.
        </p>
        <p className="mt-4 text-xs tracking-[0.2em] text-muted-foreground/70 uppercase">
          Good Lines, Better People
        </p>
      </div>
    );
  }

  const { data: marketsData } = await supabase
    .from("markets")
    .select(
      "id, type, title, description, status, lock_at, selections(id, label, american_odds, line)",
    )
    .eq("season", weekRow.season)
    .eq("week", weekRow.week)
    .in("status", ["open", "locked"])
    .order("created_at", { ascending: true });

  const markets = (marketsData ?? []) as unknown as Market[];
  const { matchups, props, futures } = groupMarkets(markets);

  return (
    <BetSlipProvider>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 pb-24">
        <PageHeading
          title={`Week ${weekRow.week}`}
          tagline={`Season ${weekRow.season}`}
          action={
            <Badge variant={weekRow.status === "open" ? "default" : "secondary"}>
              {weekRow.status}
            </Badge>
          }
        />

        {markets.length === 0 && (
          <p className="text-sm text-muted-foreground">
            This week&apos;s board is empty.
          </p>
        )}

        {matchups.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Matchups
            </h2>
            {matchups.map((m, i) => (
              <MarketCard key={m.id} market={m} stagger={i * 60} />
            ))}
          </section>
        )}

        {props.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Player Props
            </h2>
            {props.map((m, i) => (
              <MarketCard key={m.id} market={m} stagger={i * 60} />
            ))}
          </section>
        )}

        {futures.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Futures
            </h2>
            {futures.map((m, i) => (
              <MarketCard key={m.id} market={m} stagger={i * 60} />
            ))}
          </section>
        )}
      </div>
      <BetSlipDrawer />
    </BetSlipProvider>
  );
}
