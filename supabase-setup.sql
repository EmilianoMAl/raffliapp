-- ============================================================
-- Raffli – run this in the Supabase SQL editor (Dashboard → SQL)
-- ============================================================

-- 1. Profiles table
create table if not exists public.profiles (
  id              uuid references auth.users on delete cascade primary key,
  display_name    text,
  username        text unique,
  avatar_url      text,
  handicap_index  numeric,
  is_new_to_golf  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Add columns if they don't exist yet
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'username') then
    alter table public.profiles add column username text unique;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'handicap_index') then
    alter table public.profiles add column handicap_index numeric;
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_new_to_golf') then
    alter table public.profiles add column is_new_to_golf boolean not null default false;
  end if;
end $$;

-- 2. Row-level security
alter table public.profiles enable row level security;

drop policy if exists "Profiles viewable by everyone" on public.profiles;
create policy "Profiles viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- 3. Auto-create empty profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. updated_at auto-update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
