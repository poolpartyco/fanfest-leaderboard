-- Persist the live status the Highlightly API reports for a match, so the UI
-- can show the real minute / "HT" / "FT" instead of guessing from wall-clock
-- (which kept ticking through half-time).
alter table public.matches
  add column if not exists status_clock       integer,
  add column if not exists status_description text,
  add column if not exists status_observed_at timestamptz;
