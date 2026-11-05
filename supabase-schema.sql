-- First enable Anonymous Sign-Ins in Supabase Authentication settings.
-- Then run this once in the Supabase SQL Editor.
create table if not exists public.camp_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 12),
  updated_at timestamptz not null default now()
);

create table if not exists public.camping_spaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  saved_at timestamptz not null default now()
);

alter table public.camp_profiles enable row level security;
alter table public.camping_spaces enable row level security;

grant select, insert, update on public.camp_profiles to authenticated;
grant select, insert, update on public.camping_spaces to authenticated;

drop policy if exists "camp profiles are visible to visitors" on public.camp_profiles;
create policy "camp profiles are visible to visitors"
  on public.camp_profiles for select to authenticated using (true);

drop policy if exists "users can create their own camp profile" on public.camp_profiles;
create policy "users can create their own camp profile"
  on public.camp_profiles for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users can update their own camp profile" on public.camp_profiles;
create policy "users can update their own camp profile"
  on public.camp_profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "camp spaces are visible to visitors" on public.camping_spaces;
create policy "camp spaces are visible to visitors"
  on public.camping_spaces for select to authenticated using (true);

drop policy if exists "users can create their own camp space" on public.camping_spaces;
create policy "users can create their own camp space"
  on public.camping_spaces for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users can update their own camp space" on public.camping_spaces;
create policy "users can update their own camp space"
  on public.camping_spaces for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
