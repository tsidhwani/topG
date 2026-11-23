import { describe, expect, it } from "vitest";
import { americanOddsToProbability, probabilityToAmericanOdds } from "@/lib/odds";
import {
  homeWinProbabilityAnalytic,
  simulateMoneyline,
  simulateTeamExtremes,
} from "./simulate";

describe("simulateMoneyline", () => {
  it("heavily favors the team projected much higher", () => {
    const result = simulateMoneyline(160, 90, 22);
    expect(result.homeWinProbability).toBeGreaterThan(0.9);
    expect(result.homeOdds).toBeLessThan(0); // favorite -> negative odds
    expect(result.awayOdds).toBeGreaterThan(0); // underdog -> positive odds
  });

  it("is close to a coin flip for an even projected matchup", () => {
    const result = simulateMoneyline(120, 120, 22);
    expect(result.homeWinProbability).toBeGreaterThan(0.4);
    expect(result.homeWinProbability).toBeLessThan(0.6);
  });

  it("fair odds match the win probability with 0 vig applied", () => {
    const result = simulateMoneyline(130, 115, 22, 0);
    expect(result.homeFairOdds).toBe(
      probabilityToAmericanOdds(result.homeWinProbability),
    );
    expect(result.homeOdds).toBe(result.homeFairOdds);
    expect(result.awayOdds).toBe(result.awayFairOdds);
  });

  it("vig makes the priced odds worse than fair", () => {
    const result = simulateMoneyline(130, 115, 22, 0.045);
    expect(result.homeOdds).not.toBe(result.homeFairOdds);
    expect(result.awayOdds).not.toBe(result.awayFairOdds);
  });

  it("stays stable across repeated runs (no RNG seed, so this is the real check)", () => {
    const runs = Array.from({ length: 5 }, () => simulateMoneyline(130, 115, 22));
    for (const run of runs) {
      expect(run.homeWinProbability).toBeGreaterThan(0.5);
      expect(run.homeWinProbability).toBeLessThan(0.85);
    }
  });
});

describe("homeWinProbabilityAnalytic", () => {
  it("is exactly 0.5 for identical projections", () => {
    expect(homeWinProbabilityAnalytic(120, 120, 22)).toBeCloseTo(0.5, 6);
  });

  it("approaches 1 for a large projected gap", () => {
    expect(homeWinProbabilityAnalytic(200, 90, 22)).toBeGreaterThan(0.99);
  });

  it("approaches 0 for a large negative gap", () => {
    expect(homeWinProbabilityAnalytic(90, 200, 22)).toBeLessThan(0.01);
  });

  it("is symmetric: swapping home/away gives the complementary probability", () => {
    const home = homeWinProbabilityAnalytic(130, 115, 22);
    const away = homeWinProbabilityAnalytic(115, 130, 22);
    expect(home + away).toBeCloseTo(1, 6);
  });

  it("agrees closely with the Monte Carlo simulation for the same inputs", () => {
    const analytic = homeWinProbabilityAnalytic(130, 115, 22);
    const sampled = simulateMoneyline(130, 115, 22, 0).homeWinProbability;
    expect(Math.abs(analytic - sampled)).toBeLessThan(0.03);
  });
});

function tenTeams(projections: number[]) {
  return projections.map((projected, i) => ({ teamId: i + 1, projected }));
}

describe("simulateTeamExtremes", () => {
  it("fair (pre-overround) probabilities sum to ~1 for both highest and lowest", () => {
    const teams = tenTeams([130, 125, 120, 115, 110, 108, 105, 100, 95, 90]);
    const result = simulateTeamExtremes(teams, 22, 0);

    const highestSum = result.highest.reduce((sum, r) => sum + r.probability, 0);
    const lowestSum = result.lowest.reduce((sum, r) => sum + r.probability, 0);
    expect(highestSum).toBeGreaterThan(0.95);
    expect(highestSum).toBeLessThan(1.05);
    expect(lowestSum).toBeGreaterThan(0.95);
    expect(lowestSum).toBeLessThan(1.05);
  });

  it("the clearly top-projected team is the most likely highest scorer and least likely lowest scorer", () => {
    const teams = tenTeams([200, 120, 118, 116, 114, 112, 110, 108, 106, 104]);
    const result = simulateTeamExtremes(teams, 15, 0);

    const topTeamHighest = result.highest.find((r) => r.teamId === 1)!;
    const topTeamLowest = result.lowest.find((r) => r.teamId === 1)!;
    const otherHighest = result.highest.filter((r) => r.teamId !== 1);
    const otherLowest = result.lowest.filter((r) => r.teamId !== 1);

    expect(topTeamHighest.probability).toBeGreaterThan(
      Math.max(...otherHighest.map((r) => r.probability)),
    );
    expect(topTeamLowest.probability).toBeLessThan(
      Math.min(...otherLowest.map((r) => r.probability)),
    );
  });

  it("overround makes the sum of implied probabilities exceed 1 (a real edge)", () => {
    const teams = tenTeams([130, 125, 120, 115, 110, 108, 105, 100, 95, 90]);
    const result = simulateTeamExtremes(teams, 22, 0.1);

    const impliedSum = result.highest.reduce(
      (sum, r) => sum + americanOddsToProbability(r.americanOdds),
      0,
    );
    expect(impliedSum).toBeGreaterThan(1);
  });

  it("rejects fewer than two teams", () => {
    expect(() => simulateTeamExtremes([{ teamId: 1, projected: 100 }])).toThrow();
  });

  it("stays stable across repeated runs (no RNG seed, so this is the real check)", () => {
    const teams = tenTeams([130, 125, 120, 115, 110, 108, 105, 100, 95, 90]);
    const runs = Array.from({ length: 5 }, () => simulateTeamExtremes(teams, 22, 0));
    for (const run of runs) {
      const sum = run.highest.reduce((s, r) => s + r.probability, 0);
      expect(sum).toBeGreaterThan(0.9);
      expect(sum).toBeLessThan(1.1);
    }
  });
});
