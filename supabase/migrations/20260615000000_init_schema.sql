-- FanFest leaderboard schema
-- Source of truth for users, teams, matches, picks, plus poller bookkeeping.

create table if not exists public.users (
  id   text primary key,
  name text not null
);

create table if not exists public.teams (
  id                   text primary key,
  name                 text not null,
  flag                 text not null default '🏳️',
  highlightly_team_id  integer
);

create table if not exists public.matches (
  id                    text primary key,
  kickoff               timestamptz not null,
  home_team_id          text not null references public.teams (id),
  away_team_id          text not null references public.teams (id),
  home_score            integer,
  away_score            integer,
  state                 text not null default 'scheduled'
                          check (state in ('scheduled', 'live', 'finished')),
  highlightly_match_id  bigint unique
);

create index if not exists matches_kickoff_idx on public.matches (kickoff);

create table if not exists public.picks (
  match_id       text not null references public.matches (id) on delete cascade,
  user_id        text not null references public.users (id) on delete cascade,
  picked_team_id text not null references public.teams (id),
  created_at     timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- Daily Highlightly request counter (hard 100/day cap lives in the poller).
create table if not exists public.api_usage (
  day           date primary key default current_date,
  request_count integer not null default 0
);

-- Single-row throttle bookkeeping for the poller.
create table if not exists public.poll_state (
  id             boolean primary key default true check (id),
  last_polled_at timestamptz
);

insert into public.poll_state (id, last_polled_at)
values (true, null)
on conflict (id) do nothing;

-- Reject picks once the match has kicked off (enforced regardless of client).
create or replace function public.enforce_pick_before_kickoff()
returns trigger
language plpgsql
as $$
begin
  -- Only enforce the lock for end-user clients; the service-role key
  -- (seed + poller) bypasses it so historical picks can be backfilled.
  if current_user in ('anon', 'authenticated') then
    if exists (
      select 1 from public.matches m
      where m.id = new.match_id and now() >= m.kickoff
    ) then
      raise exception 'Picks are locked: match % has already kicked off', new.match_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists picks_before_kickoff on public.picks;
create trigger picks_before_kickoff
  before insert or update on public.picks
  for each row execute function public.enforce_pick_before_kickoff();

-- Row Level Security ---------------------------------------------------------
alter table public.users     enable row level security;
alter table public.teams     enable row level security;
alter table public.matches   enable row level security;
alter table public.picks     enable row level security;
alter table public.api_usage enable row level security;
alter table public.poll_state enable row level security;

-- Public (anon) read access to the leaderboard data.
create policy "public read users"   on public.users   for select using (true);
create policy "public read teams"   on public.teams   for select using (true);
create policy "public read matches" on public.matches for select using (true);
create policy "public read picks"   on public.picks   for select using (true);

-- Public pick submission (no real auth for 4 friends).
-- The before-kickoff trigger enforces the lock; RLS just opens insert/update.
create policy "public insert picks" on public.picks for insert with check (true);
create policy "public update picks" on public.picks for update using (true) with check (true);

-- api_usage / poll_state have NO anon policies: only the service-role key
-- (used by the poller) can read/write them, since service role bypasses RLS.
