-- Auth groundwork (ADDITIVE — safe to apply while the no-auth app is live).
--
-- Adds the email mapping that links a Google account to a player, plus helper
-- functions used by the confidential-picks policies. None of this changes the
-- existing open RLS, so the current production app keeps working. The actual
-- lockdown lives in the next migration and is applied at cutover.

-- Email mapping on the player rows.
alter table public.users add column if not exists email text;
create unique index if not exists users_email_lower_key on public.users (lower(email));

-- Backfill is applied out-of-band (not committed, to keep addresses out of git):
--   update public.users set email = '<gmail>' where id = 'u-yorman';  -- etc.

-- The player id for the current authenticated user, matched by email.
-- SECURITY DEFINER so it can read users without tripping users' own RLS
-- (avoids recursion when referenced from the picks policies).
create or replace function public.current_player_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.email is not null
    and lower(u.email) = lower(auth.email())
  limit 1
$$;

-- Who has locked a pick for not-yet-started matches, WITHOUT exposing the team.
-- Safe to show pre-kickoff ("3 of 4 locked in") because knowing someone has
-- voted cannot influence their hidden choice.
create or replace function public.scheduled_pick_status()
returns table(match_id text, user_id text)
language sql
stable
security definer
set search_path = public
as $$
  select p.match_id, p.user_id
  from public.picks p
  join public.matches m on m.id = p.match_id
  where m.state = 'scheduled'
$$;

grant execute on function public.current_player_id() to anon, authenticated;
grant execute on function public.scheduled_pick_status() to anon, authenticated;
