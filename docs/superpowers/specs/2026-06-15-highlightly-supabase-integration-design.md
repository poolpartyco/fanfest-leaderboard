# FanFest Leaderboard — Highlightly + Supabase Integration

**Date:** 2026-06-15
**Branch:** `feature/improvements`
**Status:** Approved design

## Problem

The leaderboard is a static Vite/React SPA that reads a bundled `src/data/leaderboard.json`.
Scores, fixtures, and picks are all hand-edited and committed. We want to:

1. Pull live World Cup scores/results automatically from the **Highlightly Soccer API**.
2. Persist data in **Supabase** instead of a JSON file.
3. Let the 4 players submit their own **picks** via a UI.
4. Stay within Highlightly's **free plan: 100 requests/day** (~4 matches/day, sequential).

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Automation scope | **Full** — scores + results + schedule discovery + pick-entry UI |
| 2 | Frontend data path | **Direct Supabase reads** (anon key + RLS); poller is a separate worker |
| 3 | Team/match identity | **Keep local ids + mapping table** to Highlightly's numeric ids |
| 4 | Poller scheduling | **Cron-triggered** (Railway cron), budget tracked in Supabase |

Additional constraints:
- Deploy target: **Railway** (frontend static + poller cron, both backed by hosted Supabase).
- Timezone for legacy kickoff strings: **America/Bogota (UTC-5, no DST)**.
- **No real auth** on picks (4 friends): name-select + kickoff lock is acceptable.
- Highlightly: league **1635** (World Cup), season **2026**. One `GET /matches?date=` call
  returns all of a day's matches with live state.

## Architecture

```
 Vite SPA  --reads (anon + RLS)-->  Supabase (Postgres)  <--writes (service role)--  Poller (Railway cron)
    |                                      ^                                              |
    +--writes picks (RLS, pre-kickoff)-----+                          1 call/poll --> Highlightly API
```

Three independently deployable pieces:
- **Frontend** — existing SPA; reads from Supabase, adds pick-entry screen, refreshes live score.
- **Poller** — Node/TS script run by Railway cron; one API call per poll; enforces budget.
- **Supabase** — source of truth; poller uses service-role key, frontend uses anon key under RLS.

## Data model (Supabase tables)

- **`users`** — `id text pk` (`u-josue`), `name text`
- **`teams`** — `id text pk` (`mex`), `name text`, `flag text`, `highlightly_team_id int null`
- **`matches`** — `id text pk` (`match-1`), `kickoff timestamptz`, `home_team_id`, `away_team_id`
  (fk teams), `home_score int null`, `away_score int null`,
  `state text` (`scheduled|live|finished`), `highlightly_match_id bigint null`
- **`picks`** — `match_id`, `user_id`, `picked_team_id`, `created_at`; unique `(match_id, user_id)`;
  insert/update rejected once `now() >= matches.kickoff` (enforced via RLS + trigger)
- **`api_usage`** — `day date pk`, `request_count int` — hard 100/day cap
- **`poll_state`** — single-row: `last_polled_at timestamptz` — throttles paid calls

### RLS policies
- `users`, `teams`, `matches`, `picks`: **public read** (anon).
- `picks`: **public insert/update** only when the related match has not kicked off.
- All writes from poller use the **service-role** key (bypasses RLS).

## Migration (JSON -> Supabase, one-time)

- Seed `users` (4), `teams` (50 with flags), `matches` (72), `picks` from `leaderboard.json`.
- Convert `date` (`"11/6"`) + `hour` (`"14:00"`) to `timestamptz` assuming **2026 / America/Bogota**.
- `highlightly_team_id` and `highlightly_match_id` start null; the poller fills them in during
  discovery by matching on team name and `(home, away, date)`.

## Poller logic (cron, every ~7 min)

Each run:
1. Load today's matches + today's `api_usage.request_count` + `poll_state.last_polled_at`.
2. **Hard stop** if `request_count >= 100`.
3. Warrant a paid call if EITHER:
   - a match is in its live window (`kickoff <= now <= kickoff + 150min`) and not `finished`
     AND `last_polled_at` was > ~7 min ago; OR
   - it is the first run of the day (one discovery call to refresh schedule + finals).
4. If warranted: one `GET /matches?leagueId=1635&season=2026&date=<today>`; increment usage;
   set `last_polled_at`.
5. Parse response -> upsert score/state/winner for each match; flip to `finished` when API says so.

Budget: 4 sequential matches x 150min / 7min ≈ ~85 calls + 1 discovery < 100. Daily cap is the backstop.

## Frontend changes

- Replace static JSON import with Supabase fetch (loading/error states).
- Keep existing pure leaderboard/winner/status logic (port into tested modules).
- **Live match**: show real score from Supabase; re-fetch every ~30s while a match is live.
- **Pick-entry UI** (design-taste-frontend skill): select player -> pick winner per upcoming match ->
  submit; locked after kickoff. Matches existing visual style.

## Testing (TDD, Vitest)

Pure logic, tests first:
- Highlightly response -> DB-row parser (against captured fixture JSON).
- Poller decision (`shouldPoll`, budget gate, live-window).
- Migration transform (JSON -> rows, Bogota date parsing).
- Leaderboard scoring / winner / match status.

## Tooling / env

- New deps: `@supabase/supabase-js`, `vitest`, `tsx`.
- Local dev/run: **Supabase CLI local stack** (Docker) — no production secrets needed locally.
- Hosted (Railway) env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `HIGHLIGHTLY_API_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.

## Delivery phases

**Chunk 1 (reviewable):** spec -> Vitest -> schema/migrations -> data migration -> Highlightly
client/parser -> poller logic/script -> frontend reads from Supabase.

**Chunk 2:** pick-entry UI (design-taste-frontend) -> live-score refresh -> README/Railway docs.

## Open / low-risk assumptions

- Legacy kickoff strings are Bogotá local time (user enters them from Colombia).
- Highlightly team-name matching to the 50 local teams may need a small manual override list for
  names that don't match exactly; surfaced in logs, not silently dropped.
