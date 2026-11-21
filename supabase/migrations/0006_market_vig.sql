-- Per-market vig override for Lines Studio. When set, it's what the
-- "linked odds" recalculation (relinkTwoWayOdds, lib/odds.ts) uses instead
-- of the global default; null means "use the page's global vig setting."
alter table public.markets
  add column vig_override numeric;
