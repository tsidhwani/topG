import { describe, expect, it } from "vitest";
import {
  americanToDecimal,
  gradeBet,
  parlayDecimalOdds,
  parlayPayoutCents,
  payoutCents,
  profitCents,
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

describe("gradeBet", () => {
  it("wins a single bet with a winning leg", () => {
    const result = gradeBet([{ odds: -150, result: "win" }], 500);
    expect(result).toEqual({ status: "win", payoutCents: 833 });
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
    expect(result).toEqual({ status: "loss", payoutCents: 0 });
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
    expect(result).toEqual({ status: "win", payoutCents: 833 });
  });

  it("drops a voided leg the same way it drops a pushed one", () => {
    const result = gradeBet(
      [
        { odds: -150, result: "win" },
        { odds: 125, result: "void" },
      ],
      500,
    );
    expect(result).toEqual({ status: "win", payoutCents: 833 });
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
