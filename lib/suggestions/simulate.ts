// Monte Carlo moneyline suggestion engine. See docs/10-suggestion-engine.md.
// Math only, never an LLM: each team's score is modeled as normal(mean =
// ESPN projected total, stddev), simulated many times, and the resulting
// win fraction converts directly to American odds. A small vig is then
// applied so both sides are slightly worse than fair.

import { applyVig, probabilityToAmericanOdds } from "@/lib/odds";

const SIMULATIONS = 10_000;
export const DEFAULT_STDDEV = 22;
export const DEFAULT_VIG = 0.045;

// Box-Muller transform for a standard normal sample.
function randomNormal(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

export interface MatchupSuggestion {
  homeWinProbability: number;
  homeFairOdds: number;
  awayFairOdds: number;
  homeOdds: number;
  awayOdds: number;
}

export function simulateMoneyline(
  homeProjected: number,
  awayProjected: number,
  stddev: number = DEFAULT_STDDEV,
  vig: number = DEFAULT_VIG,
): MatchupSuggestion {
  let homeWins = 0;

  for (let i = 0; i < SIMULATIONS; i++) {
    const homeScore = randomNormal(homeProjected, stddev);
    const awayScore = randomNormal(awayProjected, stddev);
    if (homeScore > awayScore) homeWins++;
  }

  // Clamp away from exactly 0/1 — with enough simulations and a real point
  // gap this basically never triggers, but it keeps probabilityToAmericanOdds
  // from throwing on a true-100%-in-10k-sims blowout.
  const homeWinProbability = Math.min(
    0.995,
    Math.max(0.005, homeWins / SIMULATIONS),
  );

  const homeFairOdds = probabilityToAmericanOdds(homeWinProbability);
  const awayFairOdds = probabilityToAmericanOdds(1 - homeWinProbability);

  return {
    homeWinProbability,
    homeFairOdds,
    awayFairOdds,
    homeOdds: applyVig(homeFairOdds, vig),
    awayOdds: applyVig(awayFairOdds, vig),
  };
}
