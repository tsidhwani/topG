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

const TEAM_EXTREME_SIMULATIONS = 20_000;

export interface TeamProjection {
  teamId: number;
  projected: number;
}

export interface TeamExtremeResult {
  teamId: number;
  probability: number; // fair, pre-overround
  americanOdds: number; // overround applied
}

export interface TeamExtremesResult {
  highest: TeamExtremeResult[];
  lowest: TeamExtremeResult[];
}

// 10-team (or however many) Monte Carlo for "which team scores the most /
// least this week." Each outcome is mutually exclusive (exactly one team
// wins), so the vig is applied by scaling the whole probability vector up
// to sum to 1 + overround before converting each to American odds, rather
// than per-side like the two-way moneyline case.
export function simulateTeamExtremes(
  teams: TeamProjection[],
  stddev: number = DEFAULT_STDDEV,
  overround: number = DEFAULT_VIG,
): TeamExtremesResult {
  if (teams.length < 2) {
    throw new Error("need at least two teams to simulate extremes");
  }

  const highestCounts = new Map<number, number>(teams.map((t) => [t.teamId, 0]));
  const lowestCounts = new Map<number, number>(teams.map((t) => [t.teamId, 0]));

  for (let i = 0; i < TEAM_EXTREME_SIMULATIONS; i++) {
    let highestTeam = teams[0].teamId;
    let highestScore = -Infinity;
    let lowestTeam = teams[0].teamId;
    let lowestScore = Infinity;

    for (const t of teams) {
      const score = randomNormal(t.projected, stddev);
      if (score > highestScore) {
        highestScore = score;
        highestTeam = t.teamId;
      }
      if (score < lowestScore) {
        lowestScore = score;
        lowestTeam = t.teamId;
      }
    }

    highestCounts.set(highestTeam, (highestCounts.get(highestTeam) ?? 0) + 1);
    lowestCounts.set(lowestTeam, (lowestCounts.get(lowestTeam) ?? 0) + 1);
  }

  const toResults = (counts: Map<number, number>): TeamExtremeResult[] =>
    teams.map((t) => {
      const rawP = (counts.get(t.teamId) ?? 0) / TEAM_EXTREME_SIMULATIONS;
      const probability = Math.min(0.99, Math.max(0.0005, rawP));
      const scaled = Math.min(0.99, probability * (1 + overround));
      return {
        teamId: t.teamId,
        probability,
        americanOdds: probabilityToAmericanOdds(scaled),
      };
    });

  return { highest: toResults(highestCounts), lowest: toResults(lowestCounts) };
}
