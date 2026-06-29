// Budget-aware cron poller. Run by Railway cron every ~7 minutes.
// Makes at most one Highlightly request per invocation and only when the
// decision logic warrants it (live window + throttle, or daily discovery),
// always under the 100/day cap.
import { admin } from './admin-client'
import { fetchMatchesByDate } from '../src/lib/highlightly-client'
import { parseMatchesResponse } from '../src/lib/highlightly-parser'
import { reconcileMatches } from '../src/lib/reconcile'
import { resolveBracket } from '../src/lib/bracket'
import { shouldPoll, liveTargetDates, DAILY_CAP } from '../src/lib/poller-decision'
import type { ParsedMatch } from '../src/lib/types'
import type { MatchRow } from '../src/lib/types'

const utcDate = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

// Watchdog: a single cron run does one HTTP fetch and a handful of DB writes —
// it should finish in seconds. The Highlightly/Supabase fetches have no timeout
// of their own, so if one ever stalls the run would hang forever. Under the
// poller's `restartPolicyType: NEVER` + 7-minute cron, hung runs pile up on top
// of each other. Force-exit if a run ever runs long. `.unref()` so this timer
// never keeps the process alive on its own.
const WATCHDOG_MS = 90_000
setTimeout(() => {
  console.error(`[poll] watchdog: run exceeded ${WATCHDOG_MS}ms, forcing exit`)
  process.exit(1)
}, WATCHDOG_MS).unref()

async function main() {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY
  if (!apiKey) throw new Error('Missing HIGHLIGHTLY_API_KEY')

  const now = new Date()
  const today = utcDate(now)

  const { data: matches, error: mErr } = await admin
    .from('matches')
    .select(
      'id,kickoff,home_team_id,away_team_id,home_score,away_score,state,highlightly_match_id,' +
        'stage,round,home_source_match_id,away_source_match_id,home_source_result,away_source_result,advanced_team_id',
    )
  if (mErr) throw mErr
  const matchRows = (matches ?? []) as MatchRow[]

  const { data: usage } = await admin
    .from('api_usage')
    .select('request_count')
    .eq('day', today)
    .maybeSingle()
  const requestCountToday = usage?.request_count ?? 0

  const { data: pollState } = await admin
    .from('poll_state')
    .select('last_polled_at')
    .eq('id', true)
    .maybeSingle()
  const lastPolledAt = pollState?.last_polled_at ?? null

  const decision = shouldPoll({ matches: matchRows, now, requestCountToday, lastPolledAt })
  console.log(`[poll] decision=${decision.poll} reason=${decision.reason} usage=${requestCountToday}/100`)
  if (!decision.poll) return

  // Fetch every UTC date that has a live match. Same-day concurrent matches
  // dedupe to one call; matches straddling UTC midnight need one call each, so
  // a delayed late match and an early one both stay fresh. Stay under the cap.
  const targetDates = liveTargetDates(matchRows, now, today)
  const parsed: ParsedMatch[] = []
  let calls = 0
  for (const date of targetDates) {
    if (requestCountToday + calls >= DAILY_CAP) {
      console.log(`[poll] daily cap hit, skipping remaining dates: ${targetDates.slice(calls).join(', ')}`)
      break
    }
    const json = await fetchMatchesByDate(date, apiKey)
    calls++
    // Record each spend immediately so a later failure can't under-count.
    await admin.from('api_usage').upsert({ day: today, request_count: requestCountToday + calls })
    parsed.push(...parseMatchesResponse(json))
  }
  await admin.from('poll_state').update({ last_polled_at: now.toISOString() }).eq('id', true)

  const { updates, unmatched } = reconcileMatches(parsed, matchRows)

  for (const u of updates) {
    const { error } = await admin
      .from('matches')
      .update({
        highlightly_match_id: u.highlightly_match_id,
        home_score: u.home_score,
        away_score: u.away_score,
        state: u.state,
        status_clock: u.status_clock,
        status_description: u.status_description,
        status_observed_at: now.toISOString(),
      })
      .eq('id', u.id)
    if (error) console.error(`✗ update ${u.id} failed:`, error)
  }

  // Propagate knockout results: merge this run's score/state changes into our
  // snapshot, then fill any newly-decided bracket slots and record who advanced.
  const updatedById = new Map(updates.map((u) => [u.id, u]))
  const merged: MatchRow[] = matchRows.map((m) => {
    const u = updatedById.get(m.id)
    return u ? { ...m, home_score: u.home_score, away_score: u.away_score, state: u.state } : m
  })
  const resolutions = resolveBracket(merged)
  for (const r of resolutions) {
    const patch: Record<string, unknown> = {}
    if (r.home_team_id !== undefined) patch.home_team_id = r.home_team_id
    if (r.away_team_id !== undefined) patch.away_team_id = r.away_team_id
    if (r.advanced_team_id !== undefined) patch.advanced_team_id = r.advanced_team_id
    const { error } = await admin.from('matches').update(patch).eq('id', r.id)
    if (error) console.error(`✗ resolve ${r.id} failed:`, error)
  }
  if (resolutions.length) console.log(`[poll] bracket resolutions: ${resolutions.map((r) => r.id).join(',')}`)

  console.log(`[poll] dates=${targetDates.join(',')} calls=${calls} parsed=${parsed.length} updated=${updates.length} unmatched=${unmatched.length}`)
  if (unmatched.length) {
    console.log('[poll] unmatched fixtures:', unmatched.map((p) => `${p.homeTeamName} vs ${p.awayTeamName}`).join(', '))
  }
}

// This is a one-shot cron job, not a server. Exit explicitly when the work is
// done: the Supabase client and undici's keep-alive socket pool hold open
// handles that otherwise keep the event loop alive, leaving the container
// "Running…" long after the poll finished — and the next scheduled run starts
// on top of it (restartPolicyType: NEVER doesn't relaunch, but cron still ticks).
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
