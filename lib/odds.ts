// All odds math lives here, per CLAUDE.md. See docs/08-odds-and-settlement.md
// for the spec. Money is always integer cents; odds are always nonzero
// integer American odds (e.g. -150, +125).

export type AmericanOdds = number;
export type LegResult = "pending" | "win" | "loss" | "push" | "void";

export interface ParlayLeg {
  odds: AmericanOdds;
  result: LegResult;
}

// Note this is deliberately "won"/"lost", not "win"/"loss" — it matches
// bets.status (docs/07-data-model.md), which uses different words than
// selections.result/LegResult above. Mixing them up fails the DB's
// bets_status_check constraint.
export interface GradedBetResult {
  status: "pending" | "won" | "lost" | "push" | "void";
  payoutCents: number;
}

export function americanToDecimal(odds: AmericanOdds): number {
  if (odds === 0) {
    throw new Error("american odds cannot be 0");
  }
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

export function profitCents(odds: AmericanOdds, stakeCents: number): number {
  return Math.round(stakeCents * (americanToDecimal(odds) - 1));
}

export function payoutCents(odds: AmericanOdds, stakeCents: number): number {
  return Math.round(stakeCents * americanToDecimal(odds));
}

export function parlayDecimalOdds(oddsList: AmericanOdds[]): number {
  if (oddsList.length === 0) {
    throw new Error("parlay must have at least one leg");
  }
  return oddsList.reduce((product, odds) => product * americanToDecimal(odds), 1);
}

export function parlayPayoutCents(
  oddsList: AmericanOdds[],
  stakeCents: number,
): number {
  return Math.round(stakeCents * parlayDecimalOdds(oddsList));
}

// Grades a single bet or parlay (a single is just a one-leg parlay) per
// docs/08-odds-and-settlement.md: any loss sinks the whole bet; push/void
// legs drop out and the bet is repriced on whatever's left; if everything
// dropped out, the whole bet pushes; any still-pending leg means the bet
// can't be graded yet.
export function gradeBet(legs: ParlayLeg[], stakeCents: number): GradedBetResult {
  if (legs.length === 0) {
    throw new Error("a bet must have at least one leg");
  }

  if (legs.some((leg) => leg.result === "loss")) {
    return { status: "lost", payoutCents: 0 };
  }

  if (legs.some((leg) => leg.result === "pending")) {
    return { status: "pending", payoutCents: 0 };
  }

  const liveLegs = legs.filter(
    (leg) => leg.result !== "push" && leg.result !== "void",
  );

  if (liveLegs.length === 0) {
    return { status: "push", payoutCents: stakeCents };
  }

  return {
    status: "won",
    payoutCents: parlayPayoutCents(
      liveLegs.map((leg) => leg.odds),
      stakeCents,
    ),
  };
}
