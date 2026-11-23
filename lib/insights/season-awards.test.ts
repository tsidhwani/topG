import { describe, expect, it } from "vitest";
import { computeSeasonAwards, type FinalMatchup } from "./season-awards";

const teamNameById = new Map([
  [1, "Team One"],
  [2, "Team Two"],
  [3, "Team Three"],
  [4, "Team Four"],
]);

describe("computeSeasonAwards", () => {
  it("returns all-null awards for an empty season", () => {
    const awards = computeSeasonAwards([], teamNameById);
    expect(awards.biggestBlowout).toBeNull();
    expect(awards.closestGame).toBeNull();
    expect(awards.biggestUpset).toBeNull();
    expect(awards.topScore).toBeNull();
    expect(awards.bottomScore).toBeNull();
  });

  it("picks the largest-margin game as the biggest blowout", () => {
    const matchups: FinalMatchup[] = [
      {
        week: 1,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 120,
        awayScore: 110,
        homeProjected: null,
        awayProjected: null,
      },
      {
        week: 2,
        homeTeamId: 3,
        awayTeamId: 4,
        homeScore: 150,
        awayScore: 90,
        homeProjected: null,
        awayProjected: null,
      },
    ];
    const awards = computeSeasonAwards(matchups, teamNameById);
    expect(awards.biggestBlowout).toEqual({
      week: 2,
      winner: "Team Three",
      winnerScore: 150,
      loser: "Team Four",
      loserScore: 90,
      margin: 60,
    });
  });

  it("picks the smallest-margin game as the closest game, ties included", () => {
    const matchups: FinalMatchup[] = [
      {
        week: 1,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 120,
        awayScore: 110,
        homeProjected: null,
        awayProjected: null,
      },
      {
        week: 2,
        homeTeamId: 3,
        awayTeamId: 4,
        homeScore: 100,
        awayScore: 100,
        homeProjected: null,
        awayProjected: null,
      },
    ];
    const awards = computeSeasonAwards(matchups, teamNameById);
    expect(awards.closestGame?.margin).toBe(0);
    expect(awards.closestGame?.teamA).toBe("Team Three");
  });

  it("finds the season's top and bottom single-team scores across home and away", () => {
    const matchups: FinalMatchup[] = [
      {
        week: 1,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 80,
        awayScore: 200,
        homeProjected: null,
        awayProjected: null,
      },
      {
        week: 2,
        homeTeamId: 3,
        awayTeamId: 4,
        homeScore: 60,
        awayScore: 140,
        homeProjected: null,
        awayProjected: null,
      },
    ];
    const awards = computeSeasonAwards(matchups, teamNameById);
    expect(awards.topScore).toEqual({ week: 1, team: "Team Two", score: 200 });
    expect(awards.bottomScore).toEqual({ week: 2, team: "Team Three", score: 60 });
  });

  it("ignores matchups without projections for the upset award but still scores them", () => {
    const matchups: FinalMatchup[] = [
      {
        week: 1,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 100,
        awayScore: 90,
        homeProjected: null,
        awayProjected: null,
      },
    ];
    const awards = computeSeasonAwards(matchups, teamNameById);
    expect(awards.biggestUpset).toBeNull();
    expect(awards.biggestBlowout).not.toBeNull();
  });

  it("picks the win where the actual winner was the biggest pregame underdog", () => {
    const matchups: FinalMatchup[] = [
      // Home heavily favored (big projection gap) and home wins -> not an upset.
      {
        week: 1,
        homeTeamId: 1,
        awayTeamId: 2,
        homeScore: 150,
        awayScore: 100,
        homeProjected: 150,
        awayProjected: 90,
      },
      // Home heavily favored, but away wins anyway -> a real upset.
      {
        week: 2,
        homeTeamId: 3,
        awayTeamId: 4,
        homeScore: 100,
        awayScore: 105,
        homeProjected: 150,
        awayProjected: 90,
      },
    ];
    const awards = computeSeasonAwards(matchups, teamNameById);
    expect(awards.biggestUpset?.week).toBe(2);
    expect(awards.biggestUpset?.winner).toBe("Team Four");
    expect(awards.biggestUpset?.winnerPregameWinProbability).toBeLessThan(0.5);
  });
});
