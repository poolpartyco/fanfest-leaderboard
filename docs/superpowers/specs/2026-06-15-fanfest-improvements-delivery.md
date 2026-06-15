# FanFest Leaderboard — `feature/improvements` Delivery Spec (as-built)

**Date:** 2026-06-15
**Branch:** `feature/improvements` → `main`
**Status:** Implemented, deployed, and verified on Railway
**Companion doc:** [`2026-06-15-highlightly-supabase-integration-design.md`](./2026-06-15-highlightly-supabase-integration-design.md) (the original *design*; this doc records what actually shipped)

---

## 1. Summary

This branch turns the FanFest leaderboard from a hand-edited static JSON app into a
live, Supabase-backed World Cup prediction pool for four friends, with a budget-aware
score poller and a redesigned single-theme UI — and deploys the whole thing to Railway
as infrastructure-as-code.

Three independently deployable pieces, all backed by hosted Supabase:

```
 Vite SPA  --reads (anon + RLS)-->  Supabase (Postgres)  <--writes (service role)--  Poller (Railway cron)
    |                                      ^                                              |
    +--writes picks (RLS, pre-kickoff)-----+                          1 call/poll --> Highlightly API
```

- **No backend server.** The browser reads from and writes picks directly to Supabase
  under RLS. The poller is the only writer of scores and runs on a schedule.
- **94 Vitest tests pass; `npm run build` is clean.**

## 2. What this PR delivers

| Area | Delivered |
|------|-----------|
| Data layer | Supabase schema + RLS + kickoff-lock trigger; one-time legacy-JSON migration |
| Live scores | Budget-aware poller (≤1 API call/run, ≤100/day) writing scores/state to Supabase |
| Integration libs | Highlightly client + response parser, fixture reconciliation, poller decision, scoring, migration — all TDD |
| Frontend | Supabase-driven SPA: leaderboard/podium, live banner, member voting, match history, upcoming fixtures |
| UI directions | Broadcast "Stands" live banner, "Member Rails" vote layout, next-up rollover, single Fiesta theme, CSS-drawn flags, player avatars |
| Deploy | Railway IaC (`.railway/railway.ts`): static web service + cron poller, from this branch |

## 3. Architecture (as built)

Same three pieces as the design doc, now concrete:

- **Frontend** (`src/`) — Vite + React 19 + TS SPA. Reads `users`/`teams`/`matches`/`picks`
  from Supabase via the anon key (`src/lib/supabase.ts`), computes the leaderboard client-side,
  and writes picks directly. Auto-refreshes every ~30s while a match is live
  (`src/lib/useLeaderboardData.ts`).
- **Poller** (`scripts/poll.ts`, `npm run poll`) — Node/TS via `tsx`. One Highlightly call per run
  at most, gated by budget + throttle, writes scores/state back through the service-role client
  (`scripts/admin-client.ts`).
- **Supabase** — single source of truth. Public reads + pre-kickoff pick writes via RLS; all
  score writes use the service-role key (bypasses RLS).

## 4. Data model & security (`supabase/migrations/20260615000000_init_schema.sql`)

Tables: `users`, `teams` (with `highlightly_team_id`), `matches` (with `highlightly_match_id`,
`kickoff`, `home_score`/`away_score`, `state`), `picks`, `api_usage`, `poll_state`.

`picks` is the vote store:

```sql
create table public.picks (
  match_id       text references matches(id) on delete cascade,
  user_id        text references users(id)   on delete cascade,
  picked_team_id text references teams(id),
  created_at     timestamptz default now(),
  primary key (match_id, user_id)            -- one (changeable) vote per user per match
);
```

**RLS / lock model** (no real auth — 4 friends):
- Public read on `users`/`teams`/`matches`/`picks`.
- Public insert/update on `picks`, but a `before insert or update` trigger
  (`enforce_pick_before_kickoff`) rejects writes once `now() >= matches.kickoff` for
  `anon`/`authenticated` roles. The service role bypasses it (seed/poller).
- Frontend submits via upsert on conflict `(match_id, user_id)` (`src/lib/picks.ts`), so a member
  can change their pick until kickoff.

## 5. Backend / integration libraries (TDD, `src/lib/`)

Pure, unit-tested modules (tests colocated as `*.test.ts`):

- `highlightly-client.ts` — typed HTTP client for the Highlightly Soccer API.
- `highlightly-parser.ts` — `GET /matches?date=` response → DB-row shapes (against a captured fixture).
- `reconcile.ts` — maps Highlightly numeric team/match ids onto local ids by name and `(home, away, date)`.
- `poller-decision.ts` — `shouldPoll` logic: budget gate (100/day), live window, ~7-min throttle, daily discovery.
- `scoring.ts` — leaderboard scoring (3 pts per correct winner; `draw` is a valid pick).
- `migrate-legacy.ts` — legacy `leaderboard.json` → rows, parsing `date`+`hour` as America/Bogota (UTC-5).
- `view.ts` / `designView.ts` — pure view helpers (match partitioning, kickoff formatting, pick/winner sides).

Scripts: `scripts/seed.ts` (idempotent legacy load) and `scripts/poll.ts` (one poller run).

## 6. Poller behavior (`scripts/poll.ts`)

Each run loads today's matches + `api_usage` + `poll_state`, then via `poller-decision`:
hard-stops at 100 requests/day; warrants one paid call only when a match is in its live window
(`kickoff … kickoff+150min`, not finished) and `last_polled_at` > ~7 min ago, or once/day for
discovery. On a warranted call it makes a single `GET /matches?leagueId=1635&season=2026&date=<today>`,
increments usage, upserts score/state/winner, and flips matches to `finished`. Verified in production:
`decision=true reason=live-match usage=1/100 … parsed=4 updated=4`.

## 7. Frontend (as built, `src/App.tsx` + `src/components/`)

Single-page app, hash-routed tabs (`#leaderboard|vote|matches|upcoming`), single **Fiesta** theme
(theme switcher removed; `src/lib/themes.ts`).

- **Hero + banner rollover** — when a match is live, the **Broadcast Stands** banner
  (`LiveStands.tsx`) shows the live score with each member's avatar on the side they picked.
  When no match is live, the banner rolls over to the **last full-time result** (who called it, +3 pts)
  plus a **next-up poll** (`NextUpPoll.tsx`) for the upcoming fixture. `?preview=next` forces the
  no-live view for QA.
- **Leaderboard tab** — animated podium + full ranking; each row is tappable and jumps to the
  Matches tab filtered to that member's correct picks (count-up points animation).
- **Vote tab ("Member Rails")** — per upcoming fixture: a tug-of-war tally bar + one rail per member
  with real avatars and Home/Draw/Away segments; tapping a segment upserts that member's pick
  (`castVote` → `submitPick`) and refreshes.
- **Matches tab** — past results with player/result filters and sort; per-match pick chips marked
  correct/wrong.
- **Upcoming tab** — fixtures grouped by Bogotá day with vote-progress shortcuts.
- **Flags** — CSS-drawn flags (`components/Flag.tsx`, `lib/flags.ts`) with emoji fallback; **avatars**
  bundled in `src/assets/avatars/` and resolved via `lib/avatars.ts`.

## 8. Deployment (Railway, infrastructure-as-code)

Defined in `.railway/railway.ts` (the `railway` npm package; `railway config plan/apply`). Project
**fanfest-poolparty**, two GitHub-connected services deploying from `feature/improvements`:

- **web** — Vite SPA. No start command → Railpack detects Vite, runs `npm run build`, and
  static-serves `dist/` with SPA fallback via Caddy. Build-time env: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` (baked into the bundle).
- **poller** — cron `*/7 * * * *`, `start: npm run poll`, `restartPolicyType: NEVER`, build skipped
  (`tsx`/`dotenv` are runtime deps). Runtime env: `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `HIGHLIGHTLY_API_KEY`.

Secrets are kept **out of source**; env vars are set per service in Railway. To promote to `main`,
change `BRANCH` in `.railway/railway.ts` and re-apply.

**Operational note (cost real time during rollout):** a service's first build/run can execute before
newly-set env vars propagate to the build/deploy environment. Symptom: a web bundle built with an
empty `VITE_SUPABASE_URL` renders blank, and the poller throws "Missing VITE_SUPABASE_URL". The fix is
to **redeploy after vars are set** (`railway redeploy --service <svc> --yes`); the poller self-heals on
its next cron tick. Verify the web fix at the artifact level (the live JS bundle must contain the
Supabase project ref) rather than trusting "build succeeded".

## 9. Environment variables

| Var | web | poller | Notes |
|-----|:---:|:------:|-------|
| `VITE_SUPABASE_URL` | ✅ (build) | ✅ | public; baked into bundle |
| `VITE_SUPABASE_ANON_KEY` | ✅ (build) | — | public anon key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ✅ | **secret**, server-side only |
| `HIGHLIGHTLY_API_KEY` | — | ✅ | **secret** |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | — | — | migrations only (session pooler), not runtime |

Hosted Supabase: free-tier direct DB host is IPv6-only; apply migrations through the **Session pooler**
(see README) from IPv4-only machines. App/poller traffic uses the HTTPS PostgREST API and is unaffected.

## 10. Testing & verification

- **94 Vitest tests pass** (`npm test`); `npm run build` clean (`tsc -b && vite build`).
- Production-verified: web serves HTTP 200 with the Supabase ref present in the bundle; a real poller
  run made one API call within budget and updated 4 live matches.

## 11. Follow-ups / open items

- **Promotion:** this PR targets `main`; Railway currently deploys `feature/improvements`. After merge,
  repoint `.railway/railway.ts` `BRANCH` to `main` and re-apply.
- **Team-name matching:** Highlightly → local team matching may need a small manual override list for
  names that don't match exactly; mismatches are logged (`unmatched`), not silently dropped.
- **No real auth on picks** is an accepted constraint for this private 4-person pool.
- A custom domain for the web service is not configured (Railway-generated domain only).
