import { createClient } from "@/lib/supabase/server";
import { getDefaultWeek } from "@/lib/weeks";
import { confirmWeekGraded } from "@/lib/actions/grading";
import { GradingForm } from "@/components/admin/grading-form";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Selection {
  id: string;
  label: string;
  american_odds: number;
  line: number | null;
  result: string;
}

interface Market {
  id: string;
  title: string;
  type: string;
  status: string;
  selections: Selection[];
}

export default async function AdminGradingPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const params = await searchParams;
  const season = Number(params.season) || new Date().getFullYear();
  const supabase = await createClient();
  const week = Number(params.week) || (await getDefaultWeek(supabase, season));

  const { data: weekRow } = await supabase
    .from("weeks")
    .select("season, week, status")
    .eq("season", season)
    .eq("week", week)
    .maybeSingle();

  const { data: marketsData } = await supabase
    .from("markets")
    .select(
      "id, title, type, status, selections(id, label, american_odds, line, result)",
    )
    .eq("season", season)
    .eq("week", week)
    .in("status", ["open", "locked"])
    .order("created_at", { ascending: true });

  const markets = (marketsData ?? []) as unknown as Market[];
  const hasPending = markets.some((m) =>
    m.selections.some((s) => s.result === "pending"),
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <PageHeading title="Grading" />

      <form className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="season">Season</Label>
          <Input
            id="season"
            name="season"
            type="number"
            defaultValue={season}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="week">Week</Label>
          <Input
            id="week"
            name="week"
            type="number"
            defaultValue={week}
            className="w-20"
          />
        </div>
        <Button type="submit" variant="secondary">
          Switch
        </Button>
      </form>

      {!weekRow ? (
        <p className="text-sm text-muted-foreground">No week found.</p>
      ) : markets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No gradable markets this week.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Badge variant={weekRow.status === "graded" ? "default" : "secondary"}>
              {weekRow.status}
            </Badge>
            <form action={confirmWeekGraded.bind(null, season, week)}>
              <Button
                type="submit"
                disabled={hasPending || weekRow.status === "graded"}
              >
                Confirm week graded
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
    </div>
  );
}
