-- Player props (item 4b) need to know which fantasy team owns a player
-- each week (for "same team" combos and "opposing matchup" pairing) and
-- their injury status (to skip OUT players and show it on draft rows).
-- The ESPN sync already has both in hand (lib/espn/client.ts) and was
-- just discarding them before this.
alter table public.espn_player_weeks
  add column fantasy_team_id integer,
  add column injury_status text;
