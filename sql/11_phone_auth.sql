-- ARAM store · 11 · phone-number sign-up, for a database that is ALREADY installed (fresh installs via ARAM_ALL.sql already include this).
-- Safe to run more than once.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, nullif(new.email, ''), left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120),
          case when coalesce(new.phone, '') <> '' then '+' || ltrim(new.phone, '+') end)
  on conflict (id) do nothing;
  return new;
end $$;

-- accounts created before this change get their phone copied over
insert into public.profiles (id, email, full_name, phone)
  select id, nullif(email, ''), left(coalesce(raw_user_meta_data->>'full_name', ''), 120), case when coalesce(phone, '') <> '' then '+' || ltrim(phone, '+') end
  from auth.users on conflict (id) do nothing;
update public.profiles p set phone = '+' || ltrim(u.phone, '+') from auth.users u where u.id = p.id and coalesce(u.phone, '') <> '' and p.phone is null;
