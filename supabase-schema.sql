-- First enable Anonymous Sign-Ins in Supabase Authentication settings.
-- Run the complete file in the Supabase SQL Editor. Re-running it is safe after adding features.
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

-- Friend reactions attached to campsite gear.
create table if not exists public.camp_item_reactions (
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  visitor_user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  heart boolean not null default false,
  message text check (message is null or char_length(message) <= 100),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, visitor_user_id, item_id)
);

-- Visitor placed gear waits for its campsite owner to load it.
create table if not exists public.camp_guest_items (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  contributor_user_id uuid not null references auth.users(id) on delete cascade,
  contributor_name text not null,
  source_item_id text not null,
  item jsonb not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (owner_user_id, contributor_user_id, source_item_id)
);

alter table public.camp_item_reactions enable row level security;
alter table public.camp_guest_items enable row level security;
grant select, insert, update on public.camp_item_reactions to authenticated;
grant select, insert, update on public.camp_guest_items to authenticated;

drop policy if exists "camp reactions accessible to campers" on public.camp_item_reactions;
create policy "camp reactions accessible to campers"
  on public.camp_item_reactions for all to authenticated using (true) with check (true);

drop policy if exists "guest items accessible to campers" on public.camp_guest_items;
create policy "guest items accessible to campers"
  on public.camp_guest_items for all to authenticated using (true) with check (true);

