-- Knockout penalty shootouts. A drawn knockout match (level after 120 minutes)
-- is decided on penalties: the on-pitch home/away_score stays the 120' draw —
-- which is also what pick scoring uses, so a level game scores as a draw — and
-- the shootout result lands here. The penalty winner is what advances in the
-- bracket (see advanced_team_id), independent of the drawn match score.
alter table public.matches
  add column if not exists penalty_home integer,
  add column if not exists penalty_away integer;
