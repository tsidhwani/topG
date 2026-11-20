-- Lets a user cancel their own still-open bet, as long as every leg's
-- market is still open and unlocked. Mirrors place_bet()'s pattern: a
-- security-definer function is the only way in, since bets has no
-- authenticated-update RLS policy (users can only read their own bets).
create or replace function public.cancel_bet(p_bet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_bet public.bets%rowtype;
  v_all_unlocked boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select * into v_bet from public.bets where id = p_bet_id for update;

  if not found then
    raise exception 'bet not found';
  end if;

  if v_bet.user_id != v_user_id then
    raise exception 'not your bet';
  end if;

  if v_bet.status != 'open' then
    raise exception 'bet is no longer open';
  end if;

  select bool_and(m.status = 'open' and (m.lock_at is null or now() < m.lock_at))
  into v_all_unlocked
  from public.bet_legs bl
  join public.selections s on s.id = bl.selection_id
  join public.markets m on m.id = s.market_id
  where bl.bet_id = p_bet_id;

  if not coalesce(v_all_unlocked, false) then
    raise exception 'too late to cancel — at least one leg has locked';
  end if;

  update public.bets
  set status = 'void', potential_payout_cents = stake_cents
  where id = p_bet_id;
end;
$$;

grant execute on function public.cancel_bet(uuid) to authenticated;
