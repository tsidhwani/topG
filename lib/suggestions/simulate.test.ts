import { describe, expect, it } from "vitest";
import {
  applyVig,
  probabilityToAmericanOdds,
  simulateMoneyline,
} from "./simulate";

describe("probabilityToAmericanOdds", () => {
  it("gives negative odds for a favorite (p >= 0.5)", () => {
    expect(probabilityToAmericanOdds(0.6)).toBe(-150);
  });

  it("gives positive odds for an underdog (p < 0.5)", () => {
    expect(probabilityToAmericanOdds(0.4)).toBe(150);
  });

  it("is symmetric at a coin flip", () => {
    // 0.5 takes the p >= 0.5 branch -> -100, not +100.
    expect(probabilityToAmericanOdds(0.5)).toBe(-100);
  });

  it("rejects probabilities outside (0, 1)", () => {
    expect(() => probabilityToAmericanOdds(0)).toThrow();
    expect(() => probabilityToAmericanOdds(1)).toThrow();
  });
});

describe("applyVig", () => {
  it("makes a positive-odds underdog's payout worse", () => {
    // +150 fair -> decimal 2.5 -> vigged decimal 1 + 1.5*0.95 = 2.425 -> +142
    expect(applyVig(150, 0.05)).toBe(142);
  });

  it("makes a negative-odds favorite's payout worse (odds move toward 0)", () => {
    // -150 fair -> decimal 1.6667 -> vigged decimal 1 + 0.6667*0.95 = 1.63333
    // -> profit 0.63333 < 1 -> -100/0.63333 =~ -158
    expect(applyVig(-150, 0.05)).toBe(-158);
  });

  it("0 vig leaves odds unchanged (up to rounding)", () => {
    expect(applyVig(150, 0)).toBe(150);
    expect(applyVig(-150, 0)).toBe(-150);
  });
});

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

  it("with 0 vig, both odds are consistent fair prices for the win probability", () => {
    const result = simulateMoneyline(130, 115, 22, 0);
    expect(result.homeOdds).toBe(probabilityToAmericanOdds(result.homeWinProbability));
    expect(result.awayOdds).toBe(
      probabilityToAmericanOdds(1 - result.homeWinProbability),
    );
  });
});
