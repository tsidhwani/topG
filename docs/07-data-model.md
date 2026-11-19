# Data Model

Supabase tables. Money is stored in cents as integers. Odds are stored in American format as integers (for example -150, +125).

- `profiles`: id (auth user id), display_name, role (`admin` or `user`), espn_team_id (nullable), venmo_handle, created_at.
- `espn_teams`: espn_team_id, season, name, owner_name, wins, losses, ties, points_for, points_against, synced_at.
- `espn_matchups`: id, season, week, home_team_id, away_team_id, home_projected, away_projected, home_score, away_score, is_final, synced_at.
- `espn_player_weeks`: season, week, player_id, player_name, nfl_team, position, projected_points, actual_points, is_final.
- `weeks`: season, week, status (`draft`, `open`, `locked`, `graded`, `settled`), lines_publish_at, lock_at.
- `markets`: id, season, week, type (`moneyline`, `spread`, `total`, `player_prop`, `future`), title, description, status (`draft`, `open`, `locked`, `graded`, `void`), lock_at, created_by, source (`manual` or `suggested`), linked matchup or player ids (jsonb).
- `selections`: id, market_id, label (for example "Team A ML", "Over 70.5"), american_odds, line (nullable number), result (`pending`, `win`, `loss`, `push`, `void`).
- `bets`: id, user_id, type (`single` or `parlay`), stake_cents, potential_payout_cents, status (`open`, `won`, `lost`, `push`, `void`), placed_at, settled (bool), settled_at.
- `bet_legs`: id, bet_id, selection_id, odds_at_placement (locks the price the user got).
- `suggestions`: id, season, week, type, payload (jsonb), created_at, accepted_market_id (nullable).
- `audit_log`: id, actor_id, action, details (jsonb), created_at.

Row Level Security:

- Users can read open and past markets and selections, read their own bets, and insert bets only for themselves on markets that are open and not past `lock_at`.
- Admins can read and write everything.
- Place bets through a server-side function that re-checks lock time and copies the current odds onto each leg, so the client cannot tamper with odds or timing.
