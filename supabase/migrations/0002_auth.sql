-- Email allowlist for sign-in, and auto-assigning role on first sign-in
-- based on it. See docs/03-roles.md and docs/11-setup-checklist.md.

create table public.allowed_emails (
  email text primary key,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.allowed_emails enable row level security;

create policy allowed_emails_admin_all on public.allowed_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- Looks up the signing-in email's row to decide starting role. The app
-- checks this same table before ever calling signInWithOtp, so reaching
-- here with no matching row shouldn't normally happen — default to 'user'
-- rather than failing the trigger if it does.
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
  where email = new.email;

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    case when v_is_admin then 'admin' else 'user' end
  );
  return new;
end;
$$;
