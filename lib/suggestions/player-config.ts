// Position-based standard deviations for player-level fantasy point sims.
// Starting values, not derived from this league's own data yet.
// TODO: tune these from this season's actual-vs-projected once we have
// enough weeks (same idea as DEFAULT_STDDEV in simulate.ts for teams).
export const POSITION_STDDEV: Record<string, number> = {
  QB: 7,
  RB: 7,
  WR: 7,
  TE: 5,
  K: 4,
  "D/ST": 5,
};

export const DEFAULT_POSITION_STDDEV = 7;

export function stddevForPosition(position: string): number {
  return POSITION_STDDEV[position] ?? DEFAULT_POSITION_STDDEV;
}

// How close two players' projections need to be (in points) to suggest a
// cross-fantasy-matchup head-to-head prop between them.
export const CLOSE_PROJECTION_THRESHOLD = 4;
