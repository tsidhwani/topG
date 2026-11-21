-- Adds the multi-outcome "team_prop" market type for Top & Bottom Scorer
-- (one market, one selection per team, exactly one winner). selections
-- already supports any number of rows per market and gradeBet() already
-- treats an all-void bet as a push, so this is the only schema change
-- multi-outcome markets actually need.
alter table public.markets drop constraint markets_type_check;
alter table public.markets add constraint markets_type_check
  check (type in ('moneyline', 'spread', 'total', 'player_prop', 'future', 'team_prop'));
