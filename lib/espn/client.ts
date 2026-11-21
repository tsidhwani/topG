// Unofficial ESPN Fantasy API client. See docs/05-espn-integration.md.
//
// The documented host (fantasy.espn.com) silently returns the HTML app
// shell instead of JSON — ESPN actually serves the v3 league API from
// lm-api-reads.fantasy.espn.com now. Confirmed by direct testing against
// this league; if ESPN moves it again, requests will come back as HTML
// and espnFetch will throw a clear error rather than a JSON parse crash.
const ESPN_HOST = "https://lm-api-reads.fantasy.espn.com";

// defaultPositionId -> label (stable across seasons).
const POSITIONS: Record<number, string> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "D/ST",
};

// proTeamId -> abbreviation (stable across seasons).
const NFL_TEAMS: Record<number, string> = {
  0: "FA",
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "ARI",
  23: "PIT",
  24: "LAC",
  25: "SF",
  26: "SEA",
  27: "TB",
  28: "WSH",
  29: "CAR",
  30: "JAX",
  33: "BAL",
  34: "HOU",
};

// Roster slots that don't count toward a team's starting projected total.
const NON_STARTING_SLOTS = new Set([20, 21]); // Bench, IR

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function espnFetch<T>(views: string[], extraParams = ""): Promise<T> {
  const leagueId = requiredEnv("ESPN_LEAGUE_ID");
  const season = requiredEnv("ESPN_SEASON");
  const espnS2 = requiredEnv("ESPN_S2").trim();
  const swid = requiredEnv("ESPN_SWID").trim();

  const viewParams = views.map((v) => `view=${v}`).join("&");
  const url = `${ESPN_HOST}/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?${viewParams}${extraParams}`;

  const res = await fetch(url, {
    headers: {
      Cookie: `espn_s2=${espnS2}; SWID=${swid}`,
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || !contentType.includes("application/json")) {
    throw new Error(
      `ESPN request failed (status ${res.status}, content-type ${contentType}). ` +
        "This usually means the espn_s2/SWID cookies have expired — re-grab them from a browser session.",
    );
  }

  return res.json() as Promise<T>;
}

export interface LeagueStatus {
  currentMatchupPeriod: number;
  firstScoringPeriod: number;
  finalScoringPeriod: number;
}

export async function getLeagueStatus(): Promise<LeagueStatus> {
  const data = await espnFetch<{
    status: {
      currentMatchupPeriod: number;
      firstScoringPeriod: number;
      finalScoringPeriod: number;
    };
  }>(["mStatus"]);
  return data.status;
}

export interface EspnTeam {
  espnTeamId: number;
  name: string;
  ownerName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

export async function getTeams(): Promise<EspnTeam[]> {
  const data = await espnFetch<{
    teams: {
      id: number;
      name: string;
      primaryOwner: string;
      record: {
        overall: { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number };
      };
    }[];
    members: { id: string; displayName: string; firstName?: string; lastName?: string }[];
  }>(["mTeam", "mSettings"]);

  const memberById = new Map(data.members.map((m) => [m.id, m]));

  return data.teams.map((t) => {
    const member = memberById.get(t.primaryOwner);
    const ownerName =
      member?.firstName && member?.lastName
        ? `${member.firstName} ${member.lastName}`
        : (member?.displayName ?? "Unknown");

    return {
      espnTeamId: t.id,
      name: t.name,
      ownerName,
      wins: t.record.overall.wins,
      losses: t.record.overall.losses,
      ties: t.record.overall.ties,
      pointsFor: t.record.overall.pointsFor,
      pointsAgainst: t.record.overall.pointsAgainst,
    };
  });
}

export interface EspnMatchup {
  week: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  isFinal: boolean;
}

// One call returns every week's matchups for the whole season (schedule is
// fixed at season start), so no per-week looping is needed here.
export async function getAllMatchups(): Promise<EspnMatchup[]> {
  const data = await espnFetch<{
    schedule: {
      matchupPeriodId: number;
      winner: "HOME" | "AWAY" | "TIE" | "UNDECIDED";
      home?: { teamId: number; totalPoints: number };
      away?: { teamId: number; totalPoints: number };
    }[];
  }>(["mMatchup", "mMatchupScore"]);

  return data.schedule
    .filter((s) => s.home && s.away)
    .map((s) => ({
      week: s.matchupPeriodId,
      homeTeamId: s.home!.teamId,
      awayTeamId: s.away!.teamId,
      homeScore: s.home!.totalPoints,
      awayScore: s.away!.totalPoints,
      isFinal: s.winner !== "UNDECIDED",
    }));
}

export interface PlayerWeek {
  playerId: number;
  playerName: string;
  nflTeam: string;
  position: string;
  projectedPoints: number | null;
  actualPoints: number | null;
  fantasyTeamId: number;
  injuryStatus: string | null;
}

export interface WeekBoxscore {
  players: PlayerWeek[];
  // team espnTeamId -> sum of starters' projected points for this week
  teamProjectedTotals: Record<number, number>;
}

interface RosterEntry {
  lineupSlotId: number;
  playerPoolEntry: {
    player: {
      id: number;
      fullName: string;
      proTeamId: number;
      defaultPositionId: number;
      injured?: boolean;
      injuryStatus?: string;
      stats?: {
        scoringPeriodId: number;
        statSourceId: number; // 0 = actual, 1 = projected
        appliedTotal: number;
      }[];
    };
  };
}

export async function getWeekBoxscore(week: number): Promise<WeekBoxscore> {
  const data = await espnFetch<{
    schedule: {
      matchupPeriodId: number;
      home?: { teamId: number; rosterForCurrentScoringPeriod?: { entries: RosterEntry[] } };
      away?: { teamId: number; rosterForCurrentScoringPeriod?: { entries: RosterEntry[] } };
    }[];
  }>(["mBoxscore", "mMatchupScore"], `&scoringPeriodId=${week}`);

  const players: PlayerWeek[] = [];
  const teamProjectedTotals: Record<number, number> = {};

  for (const matchup of data.schedule) {
    if (matchup.matchupPeriodId !== week) continue;

    for (const side of [matchup.home, matchup.away]) {
      if (!side?.rosterForCurrentScoringPeriod) continue;
      let teamProjected = 0;

      for (const entry of side.rosterForCurrentScoringPeriod.entries) {
        const player = entry.playerPoolEntry.player;
        const stats = player.stats ?? [];
        const actual = stats.find(
          (s) => s.scoringPeriodId === week && s.statSourceId === 0,
        )?.appliedTotal;
        const projected = stats.find(
          (s) => s.scoringPeriodId === week && s.statSourceId === 1,
        )?.appliedTotal;

        players.push({
          playerId: player.id,
          playerName: player.fullName,
          nflTeam: NFL_TEAMS[player.proTeamId] ?? "FA",
          position: POSITIONS[player.defaultPositionId] ?? "UNKNOWN",
          projectedPoints: projected ?? null,
          actualPoints: actual ?? null,
          fantasyTeamId: side.teamId,
          injuryStatus: player.injuryStatus ?? null,
        });

        if (!NON_STARTING_SLOTS.has(entry.lineupSlotId)) {
          teamProjected += projected ?? 0;
        }
      }

      teamProjectedTotals[side.teamId] = teamProjected;
    }
  }

  return { players, teamProjectedTotals };
}
