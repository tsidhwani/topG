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

// The implied win probability behind a price, vig included.
export function americanOddsToProbability(odds: AmericanOdds): number {
  return 1 / americanToDecimal(odds);
}

export function probabilityToAmericanOdds(p: number): AmericanOdds {
  if (p <= 0 || p >= 1) {
    throw new Error("probability must be strictly between 0 and 1");
  }
  return p >= 0.5
    ? Math.round((-100 * p) / (1 - p))
    : Math.round((100 * (1 - p)) / p);
}

// Shrinks the payout side of a fair price by `vig` (e.g. 0.05 = 5%),
// making it slightly worse for the bettor than fair.
export function applyVig(americanOdds: AmericanOdds, vig: number): AmericanOdds {
  const decimal = americanToDecimal(americanOdds);
  const viggedDecimal = 1 + (decimal - 1) * (1 - vig);
  const profit = viggedDecimal - 1;
  return profit >= 1 ? Math.round(profit * 100) : Math.round(-100 / profit);
}

// Admin edited one side of a two-way market to `editedOdds`, which was
// originally priced with `vig` applied via applyVig(). Inverts applyVig's
// exact formula to recover the fair probability, flips it for the other
// side, and reapplies the same vig — keeps the market's implied margin
// constant while the admin free-edits one side. Used by the Lines Studio
// "linked odds" toggle.
export function relinkTwoWayOdds(editedOdds: AmericanOdds, vig: number): AmericanOdds {
  const viggedDecimal = americanToDecimal(editedOdds);
  const fairDecimal = 1 + (viggedDecimal - 1) / (1 - vig);
  const fairProbability = 1 / fairDecimal;
  const otherFairProbability = 1 - fairProbability;
  if (otherFairProbability <= 0 || otherFairProbability >= 1) {
    throw new Error("cannot relink odds: implied probability out of range");
  }
  return applyVig(probabilityToAmericanOdds(otherFairProbability), vig);
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
