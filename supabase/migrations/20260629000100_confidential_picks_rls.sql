-- Confidential picks (BREAKING — apply ONLY at the coordinated cutover, together
-- with deploying the auth-enabled frontend).
--
-- Replaces the wide-open picks policies so that:
--   * you can only READ other players' picks once a match has started
--     (state <> 'scheduled'); your own picks are always visible to you.
--   * you can only WRITE your own pick, and only while the match is still
--     'scheduled' (before kickoff).
-- The poller writes via the service-role key, which bypasses RLS, so result
-- ingestion is unaffected. Requires 20260629000000 (helper functions) first.

drop policy if exists "public read picks"   on public.picks;
drop policy if exists "public insert picks" on public.picks;
drop policy if exists "public update picks" on public.picks;

-- Read: your own picks always; everyone's once the match is no longer scheduled.
create policy "read own or revealed picks" on public.picks for select
using (
  user_id = public.current_player_id()
  or exists (
    select 1 from public.matches m
    where m.id = picks.match_id and m.state <> 'scheduled'
  )
);

-- Insert: only your own pick, only before kickoff.
create policy "insert own scheduled pick" on public.picks for insert
with check (
  user_id = public.current_player_id()
  and exists (
    select 1 from public.matches m
    where m.id = picks.match_id and m.state = 'scheduled'
  )
);

-- Update: only your own pick, only before kickoff.
create policy "update own scheduled pick" on public.picks for update
using ( user_id = public.current_player_id() )
with check (
  user_id = public.current_player_id()
  and exists (
    select 1 from public.matches m
    where m.id = picks.match_id and m.state = 'scheduled'
  )
);
