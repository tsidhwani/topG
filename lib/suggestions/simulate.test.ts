import { describe, expect, it } from "vitest";
import { probabilityToAmericanOdds } from "@/lib/odds";
import { simulateMoneyline } from "./simulate";

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
});
