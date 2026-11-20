"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGrades } from "@/lib/actions/grading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RESULT_OPTIONS = ["pending", "win", "loss", "push", "void"];

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
  selections: Selection[];
}

export function GradingForm({
  season,
  week,
  markets,
}: {
  season: number;
  week: number;
  markets: Market[];
}) {
  const router = useRouter();
  const [results, setResults] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const m of markets) {
      for (const s of m.selections) {
        initial[s.id] = s.result;
      }
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await saveGrades(season, week, results);
        setMessage("Results saved and affected bets regraded.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {markets.map((m) => (
        <Card key={m.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{m.title}</CardTitle>
            <Badge variant="outline">{m.type}</Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {m.selections.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span>
                  {s.label}
                  {s.line != null ? ` (${s.line})` : ""} (
                  {s.american_odds > 0 ? `+${s.american_odds}` : s.american_odds})
                </span>
                <select
                  value={results[s.id]}
                  onChange={(e) =>
                    setResults((prev) => ({ ...prev, [s.id]: e.target.value }))
                  }
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  {RESULT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Save results"}
      </Button>
    </form>
  );
}
