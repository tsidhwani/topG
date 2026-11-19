-- Top G Sportsbook: initial schema, RLS, and bet placement.
-- See docs/07-data-model.md and docs/08-odds-and-settlement.md for the spec this follows.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'user' check (role in ('admin', 'user')),
  espn_team_id integer,
  venmo_handle text,
  created_at timestamptz not null default now()
);

create table public.espn_teams (
  espn_team_id integer not null,
  season integer not null,
  name text not null,
  owner_name text,
  wins integer not null default 0,
  losses integer not null default 0,
  ties integer not null default 0,
  points_for numeric not null default 0,
  points_against numeric not null default 0,
  synced_at timestamptz not null default now(),
  primary key (season, espn_team_id)
);

create table public.espn_matchups (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  week integer not null,
  home_team_id integer not null,
  away_team_id integer not null,
  home_projected numeric,
  away_projected numeric,
  home_score numeric,
  away_score numeric,
  is_final boolean not null default false,
  synced_at timestamptz not null default now(),
  unique (season, week, home_team_id, away_team_id)
);

create table public.espn_player_weeks (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  week integer not null,
  player_id bigint not null,
  player_name text not null,
  nfl_team text,
  position text,
  projected_points numeric,
  actual_points numeric,
  is_final boolean not null default false,
  unique (season, week, player_id)
);

create table public.weeks (
  season integer not null,
  week integer not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'locked', 'graded', 'settled')),
  lines_publish_at timestamptz,
  lock_at timestamptz,
  primary key (season, week)
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  week integer not null,
  type text not null
    check (type in ('moneyline', 'spread', 'total', 'player_prop', 'future')),
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'locked', 'graded', 'void')),
  lock_at timestamptz,
  created_by uuid references public.profiles (id),
  source text not null default 'manual' check (source in ('manual', 'suggested')),
  linked_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (season, week) references public.weeks (season, week)
);

create table public.selections (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets (id) on delete cascade,
  label text not null,
  american_odds integer not null check (american_odds != 0),
  line numeric,
  result text not null default 'pending'
    check (result in ('pending', 'win', 'loss', 'push', 'void')),
  created_at timestamptz not null default now()
);

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  type text not null check (type in ('single', 'parlay')),
  stake_cents integer not null check (stake_cents > 0),
  potential_payout_cents integer not null check (potential_payout_cents >= 0),
  status text not null default 'open'
    check (status in ('open', 'won', 'lost', 'push', 'void')),
  placed_at timestamptz not null default now(),
  settled boolean not null default false,
  settled_at timestamptz
);

create table public.bet_legs (
  id uuid primary key default gen_random_uuid(),
  bet_id uuid not null references public.bets (id) on delete cascade,
  selection_id uuid not null references public.selections (id),
  odds_at_placement integer not null check (odds_at_placement != 0)
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  season integer not null,
  week integer not null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  accepted_market_id uuid references public.markets (id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index bets_user_id_idx on public.bets (user_id);
create index bet_legs_bet_id_idx on public.bet_legs (bet_id);
create index bet_legs_selection_id_idx on public.bet_legs (selection_id);
create index markets_season_week_status_idx on public.markets (season, week, status);
create index selections_market_id_idx on public.selections (market_id);
create index espn_matchups_season_week_idx on public.espn_matchups (season, week);
create index espn_player_weeks_season_week_idx on public.espn_player_weeks (season, week);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- security definer so this can read profiles without recursing into the RLS
-- policy on profiles that itself calls is_admin().
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.american_to_decimal(odds integer)
returns numeric
language sql
immutable
as $$
  select case
    when odds > 0 then 1 + (odds::numeric / 100)
    else 1 + (100::numeric / abs(odds))
  end;
$$;

-- Creates the profile row when a league member first signs in via Supabase
-- Auth. Email allowlisting happens at the auth layer (invite-only), not here.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Belt-and-suspenders: even though only admins get a profiles UPDATE policy
-- for other users' rows, this stops a non-admin from ever promoting their
-- own role or relinking their own ESPN team through the self-update policy.
-- Scoped to the `authenticated` role only (real app traffic through
-- PostgREST) — direct SQL (e.g. the Supabase SQL editor) and the
-- `service_role` key are how admins actually get set by hand per
-- docs/03-roles.md, including bootstrapping the very first admin, and must
-- not be stripped by this trigger. This is SECURITY DEFINER, so current_user
-- inside the function body is always the function owner, not the caller —
-- current_setting('role') still reflects the caller's actual SET ROLE and is
-- what we need to check instead.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'authenticated' and not public.is_admin() then
    new.role := old.role;
    new.espn_team_id := old.espn_team_id;
  end if;
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.espn_teams enable row level security;
alter table public.espn_matchups enable row level security;
alter table public.espn_player_weeks enable row level security;
alter table public.weeks enable row level security;
alter table public.markets enable row level security;
alter table public.selections enable row level security;
alter table public.bets enable row level security;
alter table public.bet_legs enable row level security;
alter table public.suggestions enable row level security;
alter table public.audit_log enable row level security;

-- profiles: read own row (or admin reads all); update own row (role and
-- espn_team_id changes get stripped unless admin, see trigger above).
create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_admin_insert on public.profiles
  for insert with check (public.is_admin());

create policy profiles_admin_delete on public.profiles
  for delete using (public.is_admin());

-- ESPN cache tables: readable by any signed-in league member, writable only
-- by admins through the UI (the sync cron uses the service-role key, which
-- bypasses RLS entirely).
create policy espn_teams_select on public.espn_teams
  for select using (auth.uid() is not null);
create policy espn_teams_admin_write on public.espn_teams
  for all using (public.is_admin()) with check (public.is_admin());

create policy espn_matchups_select on public.espn_matchups
  for select using (auth.uid() is not null);
create policy espn_matchups_admin_write on public.espn_matchups
  for all using (public.is_admin()) with check (public.is_admin());

create policy espn_player_weeks_select on public.espn_player_weeks
  for select using (auth.uid() is not null);
create policy espn_player_weeks_admin_write on public.espn_player_weeks
  for all using (public.is_admin()) with check (public.is_admin());

create policy weeks_select on public.weeks
  for select using (auth.uid() is not null);
create policy weeks_admin_write on public.weeks
  for all using (public.is_admin()) with check (public.is_admin());

-- markets / selections: users see everything except drafts; admins see and
-- write everything.
create policy markets_select on public.markets
  for select using (status != 'draft' or public.is_admin());
create policy markets_admin_write on public.markets
  for all using (public.is_admin()) with check (public.is_admin());

create policy selections_select on public.selections
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.markets m
      where m.id = selections.market_id and m.status != 'draft'
    )
  );
create policy selections_admin_write on public.selections
  for all using (public.is_admin()) with check (public.is_admin());

-- bets / bet_legs: users read only their own; there is no insert policy for
-- authenticated users on purpose — all bet placement goes through
-- place_bet() below, which validates lock time and copies odds server-side.
-- Admins can still write directly (voids, manual corrections).
create policy bets_select on public.bets
  for select using (user_id = auth.uid() or public.is_admin());
create policy bets_admin_write on public.bets
  for all using (public.is_admin()) with check (public.is_admin());

create policy bet_legs_select on public.bet_legs
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.bets b
      where b.id = bet_legs.bet_id and b.user_id = auth.uid()
    )
  );
create policy bet_legs_admin_write on public.bet_legs
  for all using (public.is_admin()) with check (public.is_admin());

-- suggestions: admin-only (Phase 3 tab).
create policy suggestions_admin_all on public.suggestions
  for all using (public.is_admin()) with check (public.is_admin());

-- audit_log: admins can read and insert; nobody gets update/delete.
create policy audit_log_select on public.audit_log
  for select using (public.is_admin());
create policy audit_log_insert on public.audit_log
  for insert with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Bet placement
-- ---------------------------------------------------------------------------

-- Validates every selection is on an open, unlocked market, locks those rows
-- to avoid a race against grading/locking, prices the bet from the odds
-- as they exist right now (never trusting client-supplied odds), and inserts
-- the bet + legs atomically. Runs as the function owner (security definer),
-- which is how it's allowed to insert into bets/bet_legs despite those
-- tables having no authenticated-insert RLS policy.
create or replace function public.place_bet(
  p_type text,
  p_stake_cents integer,
  p_selection_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet_id uuid;
  v_decimal_product numeric := 1;
  v_leg_count integer;
  v_locked_count integer := 0;
  v_leg record;
  v_selection_ids uuid[] := '{}';
  v_odds integer[] := '{}';
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_stake_cents is null or p_stake_cents <= 0 then
    raise exception 'stake must be a positive number of cents';
  end if;

  v_leg_count := coalesce(array_length(p_selection_ids, 1), 0);

  if p_type = 'single' and v_leg_count != 1 then
    raise exception 'single bets must have exactly one selection';
  elsif p_type = 'parlay' and v_leg_count < 2 then
    raise exception 'parlays must have at least two selections';
  elsif p_type not in ('single', 'parlay') then
    raise exception 'unknown bet type: %', p_type;
  end if;

  -- Lock the selection rows so a concurrent admin lock/grade can't change
  -- odds or status underneath this bet while it's being placed. The lock
  -- holds until this function's transaction commits.
  for v_leg in
    select s.id as selection_id, s.american_odds
    from public.selections s
    join public.markets m on m.id = s.market_id
    where s.id = any (p_selection_ids)
      and s.result = 'pending'
      and m.status = 'open'
      and (m.lock_at is null or now() < m.lock_at)
    for update of s
  loop
    v_locked_count := v_locked_count + 1;
    v_decimal_product := v_decimal_product * public.american_to_decimal(v_leg.american_odds);
    v_selection_ids := array_append(v_selection_ids, v_leg.selection_id);
    v_odds := array_append(v_odds, v_leg.american_odds);
  end loop;

  if v_locked_count != v_leg_count then
    raise exception 'one or more selections are no longer open';
  end if;

  insert into public.bets (user_id, type, stake_cents, potential_payout_cents)
  values (
    v_user_id,
    p_type,
    p_stake_cents,
    round(p_stake_cents * v_decimal_product)
  )
  returning id into v_bet_id;

  insert into public.bet_legs (bet_id, selection_id, odds_at_placement)
  select v_bet_id, unnest(v_selection_ids), unnest(v_odds);

  return v_bet_id;
end;
$$;

grant execute on function public.place_bet(text, integer, uuid[]) to authenticated;
