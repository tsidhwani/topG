// Player-level prop simulations. Same method as the team sims (lib/
// suggestions/simulate.ts): each player's fantasy points is normal(mean =
// ESPN projection, stddev = position-based, see player-config.ts),
// simulated many times. Math only, never an LLM.

import { applyVig, probabilityToAmericanOdds } from "@/lib/odds";
import { randomNormal, DEFAULT_VIG } from "./simulate";
import { stddevForPosition } from "./player-config";

const SIMULATIONS = 10_000;

export interface PlayerProjection {
  playerId: number;
  position: string;
  projected: number;
}

export interface HeadToHeadResult {
  playerAWinProbability: number;
  playerAFairOdds: number;
  playerBFairOdds: number;
  playerAOdds: number;
  playerBOdds: number;
}

// "Player A outscores player B" — ties count as neither winning, same
// convention as the moneyline sim (continuous distributions make an exact
// tie vanishingly rare, and grading already treats an exact tie as a push
// per docs/08-odds-and-settlement.md's player-prop grading rule).
export function simulateHeadToHead(
  playerA: PlayerProjection,
  playerB: PlayerProjection,
  vig: number = DEFAULT_VIG,
): HeadToHeadResult {
  let aWins = 0;
  const stddevA = stddevForPosition(playerA.position);
  const stddevB = stddevForPosition(playerB.position);

  for (let i = 0; i < SIMULATIONS; i++) {
    const a = randomNormal(playerA.projected, stddevA);
    const b = randomNormal(playerB.projected, stddevB);
    if (a > b) aWins++;
  }

  const playerAWinProbability = Math.min(0.995, Math.max(0.005, aWins / SIMULATIONS));
  const playerAFairOdds = probabilityToAmericanOdds(playerAWinProbability);
  const playerBFairOdds = probabilityToAmericanOdds(1 - playerAWinProbability);

  return {
    playerAWinProbability,
    playerAFairOdds,
    playerBFairOdds,
    playerAOdds: applyVig(playerAFairOdds, vig),
    playerBOdds: applyVig(playerBFairOdds, vig),
  };
}

// Rounds to the nearest .5 — but if that lands exactly on a whole number
// (e.g. a projection of exactly 10.0), nudges up by .5 instead. A
// whole-number line can push (docs/08-odds-and-settlement.md); a half-point
// line never does.
function toHalfPointLine(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? rounded + 0.5 : rounded;
}

export interface OverUnderResult {
  line: number;
  overProbability: number;
  overFairOdds: number;
  underFairOdds: number;
  overOdds: number;
  underOdds: number;
}

// Covers both the combo prop ("Chase + Lamb + Jefferson over X.5", pass an
// array of players) and the single-player prop (pass a one-element array)
// with the same math: the line is the summed projection rounded to the
// nearest .5 (so it can never push), and the over/under probability comes
// from simulating the sum of each player's independent normal score.
export function simulateOverUnder(
  players: PlayerProjection[],
  vig: number = DEFAULT_VIG,
): OverUnderResult {
  if (players.length === 0) {
    throw new Error("need at least one player");
  }

  const sumProjected = players.reduce((sum, p) => sum + p.projected, 0);
  const line = toHalfPointLine(sumProjected);

  let overCount = 0;
  for (let i = 0; i < SIMULATIONS; i++) {
    let total = 0;
    for (const p of players) {
      total += randomNormal(p.projected, stddevForPosition(p.position));
    }
    if (total > line) overCount++;
  }

  const overProbability = Math.min(0.995, Math.max(0.005, overCount / SIMULATIONS));
  const overFairOdds = probabilityToAmericanOdds(overProbability);
  const underFairOdds = probabilityToAmericanOdds(1 - overProbability);

  return {
    line,
    overProbability,
    overFairOdds,
    underFairOdds,
    overOdds: applyVig(overFairOdds, vig),
    underOdds: applyVig(underFairOdds, vig),
  };
}
