import { describe, expect, it } from "vitest";
import { americanOddsToProbability } from "@/lib/odds";
import { simulateHeadToHead, simulateOverUnder } from "./player-props";

describe("simulateHeadToHead", () => {
  it("heavily favors the much-higher-projected player", () => {
    const result = simulateHeadToHead(
      { playerId: 1, position: "WR", projected: 25 },
      { playerId: 2, position: "WR", projected: 10 },
    );
    expect(result.playerAWinProbability).toBeGreaterThan(0.9);
    expect(result.playerAOdds).toBeLessThan(0);
    expect(result.playerBOdds).toBeGreaterThan(0);
  });

  it("is close to a coin flip for near-identical projections", () => {
    const result = simulateHeadToHead(
      { playerId: 1, position: "RB", projected: 15 },
      { playerId: 2, position: "RB", projected: 15 },
    );
    expect(result.playerAWinProbability).toBeGreaterThan(0.4);
    expect(result.playerAWinProbability).toBeLessThan(0.6);
  });

  it("uses a tighter position stddev for a TE than a QB (sanity: TE closer bet is more lopsided for the same gap)", () => {
    const teGap = simulateHeadToHead(
      { playerId: 1, position: "TE", projected: 14 },
      { playerId: 2, position: "TE", projected: 10 },
    );
    const qbGap = simulateHeadToHead(
      { playerId: 1, position: "QB", projected: 14 },
      { playerId: 2, position: "QB", projected: 10 },
    );
    // TE has a smaller stddev (5 vs 7), so the same 4-point gap should
    // produce a more lopsided (farther from 0.5) win probability for TEs.
    expect(Math.abs(teGap.playerAWinProbability - 0.5)).toBeGreaterThan(
      Math.abs(qbGap.playerAWinProbability - 0.5),
    );
  });
});

describe("simulateOverUnder", () => {
  it("single player: line is that player's own projection rounded to .5", () => {
    const result = simulateOverUnder([{ playerId: 1, position: "RB", projected: 17.3 }]);
    expect(result.line).toBe(17.5);
    expect(result.overProbability).toBeGreaterThan(0.3);
    expect(result.overProbability).toBeLessThan(0.7);
  });

  it("combo: line is the summed projection rounded to .5", () => {
    const result = simulateOverUnder([
      { playerId: 1, position: "WR", projected: 18.2 },
      { playerId: 2, position: "WR", projected: 16.1 },
      { playerId: 3, position: "WR", projected: 14.0 },
    ]);
    expect(result.line).toBe(48.5); // 48.3 rounded to nearest .5
  });

  it("never lands on a whole number (always pushable-proof)", () => {
    for (const projected of [10, 20.0, 15.25, 33.33]) {
      const result = simulateOverUnder([{ playerId: 1, position: "WR", projected }]);
      expect(result.line % 1).not.toBe(0);
    }
  });

  it("vig makes the implied probabilities on both sides sum above 1", () => {
    const result = simulateOverUnder(
      [{ playerId: 1, position: "WR", projected: 15 }],
      0.045,
    );
    const impliedSum =
      americanOddsToProbability(result.overOdds) +
      americanOddsToProbability(result.underOdds);
    expect(impliedSum).toBeGreaterThan(1);
  });

  it("rejects an empty player list", () => {
    expect(() => simulateOverUnder([])).toThrow();
  });
});
