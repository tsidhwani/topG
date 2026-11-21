-- Supabase normalizes auth.users.email to lowercase, but allowed_emails
-- rows get typed by hand (e.g. 'Willshah11@gmail.com') and Postgres text
-- equality is case-sensitive, so the exact-match lookup in handle_new_user
-- could silently never match a mixed-case row. Compare case-insensitively
-- instead of relying on everyone always typing lowercase.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin
  from public.allowed_emails
  where lower(email) = lower(new.email);

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    case when v_is_admin then 'admin' else 'user' end
  );
  return new;
end;
$$;
