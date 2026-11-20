import { createClient } from "@/lib/supabase/server";
import { upsertWeek, publishWeek } from "@/lib/actions/admin-lines";
import { MarketForm } from "@/components/admin/market-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Formats an ISO timestamp for a <input type="datetime-local"> default value.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminLinesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; week?: string }>;
}) {
  const params = await searchParams;
  const season = Number(params.season) || new Date().getFullYear();
  const week = Number(params.week) || 1;

  const supabase = await createClient();

  const { data: weekRow } = await supabase
    .from("weeks")
    .select("season, week, status, lock_at, lines_publish_at")
    .eq("season", season)
    .eq("week", week)
    .maybeSingle();

  const { data: markets } = await supabase
    .from("markets")
    .select(
      "id, type, title, description, status, lock_at, selections(id, label, american_odds, line, result)",
    )
    .eq("season", season)
    .eq("week", week)
    .order("created_at", { ascending: true });

  const draftCount = markets?.filter((m) => m.status === "draft").length ?? 0;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Lines Builder</h1>

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

      <form action={upsertWeek} className="flex items-end gap-3">
        <input type="hidden" name="season" value={season} />
        <input type="hidden" name="week" value={week} />
        <div className="flex flex-col gap-1">
          <Label htmlFor="lock_at">Default lock time for this week</Label>
          <Input
            id="lock_at"
            name="lock_at"
            type="datetime-local"
            defaultValue={
              weekRow?.lock_at ? toLocalInputValue(weekRow.lock_at) : ""
            }
          />
        </div>
        <Button type="submit">{weekRow ? "Update week" : "Create week"}</Button>
      </form>

      {weekRow ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Season {season}, Week {week}
            </CardTitle>
            <div className="flex items-center gap-3">
              <Badge variant={weekRow.status === "open" ? "default" : "secondary"}>
                {weekRow.status}
              </Badge>
              {draftCount > 0 && (
                <form action={publishWeek.bind(null, season, week)}>
                  <Button type="submit">Publish week</Button>
                </form>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {markets && markets.length > 0 ? (
              markets.map((m) => (
                <div key={m.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{m.title}</span>
                    <Badge variant="outline">{m.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.type}</p>
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {m.selections?.map((s) => (
                      <li key={s.id} className="flex justify-between">
                        <span>
                          {s.label}
                          {s.line != null ? ` (${s.line})` : ""}
                        </span>
                        <span>
                          {s.american_odds > 0 ? `+${s.american_odds}` : s.american_odds}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No markets yet.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          Create this week above before adding markets.
        </p>
      )}

      {weekRow && <MarketForm season={season} week={week} />}
    </div>
  );
}
