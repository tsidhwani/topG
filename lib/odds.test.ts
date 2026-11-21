import { describe, expect, it } from "vitest";
import {
  americanOddsToProbability,
  americanToDecimal,
  applyVig,
  gradeBet,
  parlayDecimalOdds,
  parlayPayoutCents,
  payoutCents,
  probabilityToAmericanOdds,
  profitCents,
  relinkTwoWayOdds,
} from "./odds";

describe("americanToDecimal", () => {
  it("converts positive odds", () => {
    expect(americanToDecimal(125)).toBeCloseTo(2.25);
  });

  it("converts negative odds", () => {
    expect(americanToDecimal(-150)).toBeCloseTo(1.6667, 4);
  });

  it("rejects 0", () => {
    expect(() => americanToDecimal(0)).toThrow();
  });
});

// Worked examples straight from docs/08-odds-and-settlement.md.
describe("profitCents / payoutCents", () => {
  it("+125, $5 stake: $6.25 profit, $11.25 returned", () => {
    expect(profitCents(125, 500)).toBe(625);
    expect(payoutCents(125, 500)).toBe(1125);
  });

  it("-150, $5 stake: $3.33 profit, $8.33 returned", () => {
    expect(profitCents(-150, 500)).toBe(333);
    expect(payoutCents(-150, 500)).toBe(833);
  });
});

describe("parlayDecimalOdds / parlayPayoutCents", () => {
  it("multiplies decimal odds across legs", () => {
    expect(parlayDecimalOdds([-150, 125])).toBeCloseTo(3.75, 4);
  });

  it("prices a $5 two-leg parlay at -150 and +125", () => {
    expect(parlayPayoutCents([-150, 125], 500)).toBe(1875);
  });

  it("rejects an empty leg list", () => {
    expect(() => parlayDecimalOdds([])).toThrow();
  });
});

describe("americanOddsToProbability", () => {
  it("round-trips with probabilityToAmericanOdds", () => {
    expect(americanOddsToProbability(probabilityToAmericanOdds(0.6))).toBeCloseTo(0.6, 2);
  });
});

describe("probabilityToAmericanOdds", () => {
  it("gives negative odds for a favorite (p >= 0.5)", () => {
    expect(probabilityToAmericanOdds(0.6)).toBe(-150);
  });

  it("gives positive odds for an underdog (p < 0.5)", () => {
    expect(probabilityToAmericanOdds(0.4)).toBe(150);
  });

  it("is symmetric at a coin flip", () => {
    expect(probabilityToAmericanOdds(0.5)).toBe(-100);
  });

  it("rejects probabilities outside (0, 1)", () => {
    expect(() => probabilityToAmericanOdds(0)).toThrow();
    expect(() => probabilityToAmericanOdds(1)).toThrow();
  });
});

describe("applyVig", () => {
  it("makes a positive-odds underdog's payout worse", () => {
    expect(applyVig(150, 0.05)).toBe(142);
  });

  it("makes a negative-odds favorite's payout worse (odds move toward 0)", () => {
    expect(applyVig(-150, 0.05)).toBe(-158);
  });

  it("0 vig leaves odds unchanged", () => {
    expect(applyVig(150, 0)).toBe(150);
    expect(applyVig(-150, 0)).toBe(-150);
  });
});

describe("relinkTwoWayOdds", () => {
  it("recovers the original other-side odds for a vig-consistent pair", () => {
    // Fair 60/40 split at 4.5% vig: home -150 -> fair .6, away +150 -> fair .4
    const homeFair = probabilityToAmericanOdds(0.6);
    const awayFair = probabilityToAmericanOdds(0.4);
    const homeVigged = applyVig(homeFair, 0.045);
    const awayVigged = applyVig(awayFair, 0.045);

    // Editing nothing: relinking the home side should reproduce the away side.
    expect(relinkTwoWayOdds(homeVigged, 0.045)).toBe(awayVigged);
  });

  it("recalculates the other side after an edit, keeping the same vig", () => {
    // Admin edits the home side to a juicier -120 (closer to a coin flip).
    const recalculatedAway = relinkTwoWayOdds(-120, 0.045);
    // The implied probabilities (post-vig) of both sides should sum to
    // slightly over 1 by the overround, not exactly 1 (that's the vig).
    const impliedSum =
      americanOddsToProbability(-120) + americanOddsToProbability(recalculatedAway);
    expect(impliedSum).toBeGreaterThan(1);
    expect(impliedSum).toBeLessThan(1.15);
  });

  it("with 0 vig, the other side is exactly the complementary fair price", () => {
    const home = probabilityToAmericanOdds(0.7);
    const away = relinkTwoWayOdds(home, 0);
    expect(away).toBe(probabilityToAmericanOdds(0.3));
  });
});

describe("gradeBet", () => {
  it("wins a single bet with a winning leg", () => {
    const result = gradeBet([{ odds: -150, result: "win" }], 500);
    expect(result).toEqual({ status: "won", payoutCents: 833 });
  });

  it("pushes a single bet with a pushed leg (stake returned)", () => {
    const result = gradeBet([{ odds: -150, result: "push" }], 500);
    expect(result).toEqual({ status: "push", payoutCents: 500 });
  });

  it("loses if any leg loses, regardless of the others", () => {
    const result = gradeBet(
      [
        { odds: -150, result: "win" },
        { odds: 125, result: "loss" },
      ],
      500,
    );
    expect(result).toEqual({ status: "lost", payoutCents: 0 });
  });

  it("is pending while any leg is still pending", () => {
    const result = gradeBet(
      [
        { odds: -150, result: "win" },
        { odds: 125, result: "pending" },
      ],
      500,
    );
    expect(result).toEqual({ status: "pending", payoutCents: 0 });
  });

  it("drops a pushed leg and reprices the parlay on what's left", () => {
    // -150 win, +125 push -> repriced as a single -150 bet.
    const result = gradeBet(
      [
        { odds: -150, result: "win" },
        { odds: 125, result: "push" },
      ],
      500,
    );
    expect(result).toEqual({ status: "won", payoutCents: 833 });
  });

  it("drops a voided leg the same way it drops a pushed one", () => {
    const result = gradeBet(
      [
        { odds: -150, result: "win" },
        { odds: 125, result: "void" },
      ],
      500,
    );
    expect(result).toEqual({ status: "won", payoutCents: 833 });
  });

  it("pushes the whole parlay when every leg pushes or voids", () => {
    const result = gradeBet(
      [
        { odds: -150, result: "push" },
        { odds: 125, result: "void" },
      ],
      500,
    );
    expect(result).toEqual({ status: "push", payoutCents: 500 });
  });

  it("throws for a bet with no legs", () => {
    expect(() => gradeBet([], 500)).toThrow();
  });
});
