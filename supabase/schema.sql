-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)

create extension if not exists pgcrypto;

-- Fixed (regular) players, with their skill ratings
create table if not exists fixed_players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  defense int not null check (defense between 1 and 100),
  passing int not null check (passing between 1 and 100),
  attack int not null check (attack between 1 and 100),
  fitness int not null check (fitness between 1 and 100),
  overall_score int not null check (overall_score between 1 and 100),
  -- Manual draft tier (1 = strongest, 6 = weakest), used to steer team balancing.
  pick_tier int check (pick_tier between 1 and 6),
  created_at timestamptz not null default now()
);

-- Registrations for the upcoming Saturday. Cleared out every week via the reset button.
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  player_name text not null,
  is_fixed boolean not null default false,
  fixed_player_id uuid references fixed_players(id) on delete set null,
  defense int not null check (defense between 1 and 100),
  passing int not null check (passing between 1 and 100),
  attack int not null check (attack between 1 and 100),
  fitness int not null check (fitness between 1 and 100),
  overall_score int not null check (overall_score between 1 and 100),
  pick_tier int check (pick_tier between 1 and 6),
  position text,
  invited_by text,
  status text not null default 'confirmed' check (status in ('confirmed', 'standby')),
  created_at timestamptz not null default now()
);

create index if not exists registrations_status_created_idx on registrations (status, created_at);

-- Snapshot of the last team draw ("יאללה בלגן"), so the result screen survives a refresh.
create table if not exists team_draws (
  id uuid primary key default gen_random_uuid(),
  teams jsonb not null,
  created_at timestamptz not null default now()
);

-- "Special requests": groups of 2-3 players who asked to play on the same team.
-- Cleared out together with the registrations on the weekly reset.
create table if not exists special_requests (
  id uuid primary key default gen_random_uuid(),
  players text[] not null check (array_length(players, 1) between 2 and 3),
  created_at timestamptz not null default now()
);

-- Row Level Security: this app has no login, so every visitor uses the anon key.
-- We open read/write to everyone on purpose (small trusted group of friends).
alter table fixed_players enable row level security;
alter table registrations enable row level security;
alter table team_draws enable row level security;
alter table special_requests enable row level security;

drop policy if exists "public full access" on fixed_players;
create policy "public full access" on fixed_players for all using (true) with check (true);

drop policy if exists "public full access" on registrations;
create policy "public full access" on registrations for all using (true) with check (true);

drop policy if exists "public full access" on team_draws;
create policy "public full access" on team_draws for all using (true) with check (true);

drop policy if exists "public full access" on special_requests;
create policy "public full access" on special_requests for all using (true) with check (true);

-- Enable realtime updates for the registration list
alter publication supabase_realtime add table registrations;
