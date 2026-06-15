# FanFest · PoolParty — World Cup Leaderboard

A World Cup prediction pool for four friends. Live scores come from the
**Highlightly Soccer API**, everything is persisted in **Supabase**, and a
budget-aware cron poller keeps scores fresh without blowing the free-tier
request limit. The frontend is a Vite + React + TypeScript SPA.

## Architecture

```
 Vite SPA  --reads (anon + RLS)-->  Supabase (Postgres)  <--writes (service role)--  Poller (cron)
    |                                      ^                                            |
    +--writes picks (RLS, pre-kickoff)-----+                        1 call/poll --> Highlightly API
```

- **Frontend** (`src/`): reads users/teams/matches/picks from Supabase over HTTPS,
  computes the leaderboard, shows live scores, and lets players submit picks.
  Auto-refreshes every 30s while a match is live.
- **Poller** (`scripts/poll.ts`): run on a schedule. Makes **at most one** API call per
  run, only when a match is live (throttled to ~7 min) or once per day for discovery,
  and never past 100 requests/day. Writes scores/state back to Supabase.
- **Supabase**: source of truth. RLS allows public reads and pick submissions
  (locked at kickoff by a trigger); the poller/seed use the service-role key.

Scoring: **3 points per correct match winner**. A pick of `draw` is valid.

## Data model

`users`, `teams` (with `highlightly_team_id`), `matches` (with `highlightly_match_id`,
`kickoff`, scores, `state`), `picks`, plus `api_usage` (daily request counter) and
`poll_state` (poll throttle). See `supabase/migrations/`.

## Local development

1. Copy env: `cp .env.example .env` and fill in your Supabase + Highlightly values.
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — browser (anon).
   - `SUPABASE_SERVICE_ROLE_KEY`, `HIGHLIGHTLY_API_KEY` — server-side only.
2. `npm install`
3. `npm run dev` — app at http://localhost:5173

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run the SPA locally |
| `npm test` | Run the Vitest suite |
| `npm run build` | Typecheck + production build |
| `npm run seed` | Load the bundled legacy JSON into Supabase (idempotent) |
| `npm run poll` | One poller run (decision → maybe one API call → update) |

### Applying the schema to a hosted project

The free-tier direct DB host is IPv6-only. From an IPv4-only machine, apply the
migration through the **Session pooler** (Dashboard → Connect → Session pooler):

```bash
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h aws-1-<region>.pooler.supabase.com -p 5432 \
  -U postgres.<project-ref> -d postgres \
  -f supabase/migrations/20260615000000_init_schema.sql
```

All app/poller traffic uses the HTTPS PostgREST API, so it is unaffected by IPv6.

## Deploy on Railway

Two services from this repo:

1. **Web** — build `npm run build`, serve `dist/` (static). Env: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`.
2. **Poller (Cron)** — schedule `*/7 * * * *`, command `npm run poll`. Env:
   `VITE_SUPABASE_URL` (or `SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY`,
   `HIGHLIGHTLY_API_KEY`. `tsx` and `dotenv` are runtime dependencies so the cron
   command works with a production install.

Run `npm run seed` once (locally or as a one-off) to populate the tables.
