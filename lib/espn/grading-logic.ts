// Pure win/loss/push/void decision logic, shared by every autograde
// function in autograde.ts. Kept separate from the DB I/O so it's unit
// testable without mocking Supabase's query builder.

import type { LegResult } from "@/lib/odds";

// Compares two numbers and decides a winner — the same shape underlies a
// moneyline (home score vs away score), a player head-to-head (player A's
// points vs player B's), and an over/under (actual total vs the line).
// An exact tie pushes both sides.
export function compareTwoWay(a: number, b: number): { a: LegResult; b: LegResult } {
  if (a > b) return { a: "win", b: "loss" };
  if (b > a) return { a: "loss", b: "win" };
  return { a: "push", b: "push" };
}

// N-way "which team is the extreme" (highest or lowest scorer). An exact
// tie for the extreme voids every selection (refunded via gradeBet's
// existing all-void-pushes handling), not just the tied teams — nobody
// can fairly win a "highest scoring team" bet when two teams tied for it.
export function gradeExtreme(
  scoresByTeam: Map<number, number>,
  teamIds: number[],
  kind: "highest" | "lowest",
): Map<number, LegResult> {
  const values = teamIds
    .map((id) => scoresByTeam.get(id))
    .filter((v): v is number => v != null);
  if (values.length === 0) {
    return new Map(teamIds.map((id) => [id, "pending" as LegResult]));
  }

  const extreme = kind === "highest" ? Math.max(...values) : Math.min(...values);
  const winners = teamIds.filter((id) => scoresByTeam.get(id) === extreme);
  const tied = winners.length > 1;

  const results = new Map<number, LegResult>();
  for (const id of teamIds) {
    results.set(id, tied ? "void" : winners[0] === id ? "win" : "loss");
  }
  return results;
}
