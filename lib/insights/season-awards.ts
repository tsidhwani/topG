import { homeWinProbabilityAnalytic } from "@/lib/suggestions/simulate";

export interface FinalMatchup {
  week: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  homeProjected: number | null;
  awayProjected: number | null;
}

export interface BlowoutAward {
  week: number;
  winner: string;
  winnerScore: number;
  loser: string;
  loserScore: number;
  margin: number;
}

export interface ClosestGameAward {
  week: number;
  teamA: string;
  teamAScore: number;
  teamB: string;
  teamBScore: number;
  margin: number;
}

export interface UpsetAward {
  week: number;
  winner: string;
  winnerScore: number;
  loser: string;
  loserScore: number;
  winnerPregameWinProbability: number;
}

export interface ExtremeScoreAward {
  week: number;
  team: string;
  score: number;
}

export interface SeasonAwards {
  biggestBlowout: BlowoutAward | null;
  closestGame: ClosestGameAward | null;
  biggestUpset: UpsetAward | null;
  topScore: ExtremeScoreAward | null;
  bottomScore: ExtremeScoreAward | null;
}

// Pure, deterministic season-highlights calc over already-finalized
// matchups. Kept separate from any DB/React concerns so it's unit-testable
// without a Supabase round-trip.
export function computeSeasonAwards(
  matchups: FinalMatchup[],
  teamNameById: Map<number, string>,
): SeasonAwards {
  const nameOf = (id: number) => teamNameById.get(id) ?? `Team ${id}`;

  let biggestBlowout: BlowoutAward | null = null;
  let closestGame: ClosestGameAward | null = null;
  let biggestUpset: UpsetAward | null = null;
  let topScore: ExtremeScoreAward | null = null;
  let bottomScore: ExtremeScoreAward | null = null;

  for (const m of matchups) {
    const margin = Math.abs(m.homeScore - m.awayScore);

    if (m.homeScore !== m.awayScore) {
      const winnerIsHome = m.homeScore > m.awayScore;
      const blowout: BlowoutAward = {
        week: m.week,
        winner: nameOf(winnerIsHome ? m.homeTeamId : m.awayTeamId),
        winnerScore: winnerIsHome ? m.homeScore : m.awayScore,
        loser: nameOf(winnerIsHome ? m.awayTeamId : m.homeTeamId),
        loserScore: winnerIsHome ? m.awayScore : m.homeScore,
        margin,
      };
      if (!biggestBlowout || margin > biggestBlowout.margin) {
        biggestBlowout = blowout;
      }

      if (m.homeProjected != null && m.awayProjected != null) {
        const homeWinProb = homeWinProbabilityAnalytic(m.homeProjected, m.awayProjected);
        const winnerPregameWinProbability = winnerIsHome ? homeWinProb : 1 - homeWinProb;
        if (
          !biggestUpset ||
          winnerPregameWinProbability < biggestUpset.winnerPregameWinProbability
        ) {
          biggestUpset = {
            week: m.week,
            winner: blowout.winner,
            winnerScore: blowout.winnerScore,
            loser: blowout.loser,
            loserScore: blowout.loserScore,
            winnerPregameWinProbability,
          };
        }
      }
    }

    if (!closestGame || margin < closestGame.margin) {
      closestGame = {
        week: m.week,
        teamA: nameOf(m.homeTeamId),
        teamAScore: m.homeScore,
        teamB: nameOf(m.awayTeamId),
        teamBScore: m.awayScore,
        margin,
      };
    }

    if (!topScore || m.homeScore > topScore.score) {
      topScore = { week: m.week, team: nameOf(m.homeTeamId), score: m.homeScore };
    }
    if (!topScore || m.awayScore > topScore.score) {
      topScore = { week: m.week, team: nameOf(m.awayTeamId), score: m.awayScore };
    }
    if (!bottomScore || m.homeScore < bottomScore.score) {
      bottomScore = { week: m.week, team: nameOf(m.homeTeamId), score: m.homeScore };
    }
    if (!bottomScore || m.awayScore < bottomScore.score) {
      bottomScore = { week: m.week, team: nameOf(m.awayTeamId), score: m.awayScore };
    }
  }

  return { biggestBlowout, closestGame, biggestUpset, topScore, bottomScore };
}
