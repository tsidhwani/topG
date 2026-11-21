-- Single source of truth for "what week is it right now," replacing the
-- old guess-from-synced-matchups approach. syncAll() upserts current_week
-- from ESPN's own status.currentMatchupPeriod on every sync; admins can
-- override it by hand (current_week_override) for edge cases ESPN gets
-- wrong (e.g. right after a season rolls over).
create table public.league_state (
  season integer primary key,
  current_week integer not null,
  current_week_override integer,
  synced_at timestamptz not null default now()
);

alter table public.league_state enable row level security;

create policy league_state_select on public.league_state
  for select using (auth.uid() is not null);

create policy league_state_admin_write on public.league_state
  for all using (public.is_admin()) with check (public.is_admin());
