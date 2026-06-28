-- Knockout-stage support: tag each match with its stage/round and wire the
-- bracket feeder graph so winners (and the semi-final losers) flow into the
-- next slot as results land. Round-of-32 rows carry real teams now; later
-- rounds start with null team slots that resolve over the tournament.

alter table public.matches
  add column if not exists stage text not null default 'group'
    check (stage in ('group', 'knockout')),
  add column if not exists round text
    check (round in ('r32', 'r16', 'qf', 'sf', 'final', 'third')),
  add column if not exists bracket_order integer,
  add column if not exists home_source_match_id text references public.matches (id),
  add column if not exists away_source_match_id text references public.matches (id),
  add column if not exists home_source_result text
    check (home_source_result in ('winner', 'loser')),
  add column if not exists away_source_result text
    check (away_source_result in ('winner', 'loser')),
  add column if not exists advanced_team_id text references public.teams (id);

-- Unresolved knockout slots have no team yet, so home/away can be null.
alter table public.matches
  alter column home_team_id drop not null,
  alter column away_team_id drop not null;
