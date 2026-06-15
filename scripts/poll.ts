// Budget-aware cron poller. Run by Railway cron every ~7 minutes.
// Makes at most one Highlightly request per invocation and only when the
// decision logic warrants it (live window + throttle, or daily discovery),
// always under the 100/day cap.
import { admin } from './admin-client'
import { fetchMatchesByDate } from '../src/lib/highlightly-client'
import { parseMatchesResponse } from '../src/lib/highlightly-parser'
import { reconcileMatches } from '../src/lib/reconcile'
import { isInLiveWindow, shouldPoll } from '../src/lib/poller-decision'
import type { MatchRow } from '../src/lib/types'

const utcDate = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

async function main() {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY
  if (!apiKey) throw new Error('Missing HIGHLIGHTLY_API_KEY')

  const now = new Date()
  const today = utcDate(now)

  const { data: matches, error: mErr } = await admin
    .from('matches')
    .select('id,kickoff,home_team_id,away_team_id,home_score,away_score,state,highlightly_match_id')
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

  // Query the date of the live match if there is one, else today.
  const liveMatch = matchRows.find((m) => m.state !== 'finished' && isInLiveWindow(m.kickoff, now))
  const targetDate = liveMatch ? utcDate(new Date(liveMatch.kickoff)) : today

  const json = await fetchMatchesByDate(targetDate, apiKey)

  // Record the spend immediately so a later failure can't under-count.
  await admin.from('api_usage').upsert({ day: today, request_count: requestCountToday + 1 })
  await admin.from('poll_state').update({ last_polled_at: now.toISOString() }).eq('id', true)

  const parsed = parseMatchesResponse(json)
  const { updates, unmatched } = reconcileMatches(parsed, matchRows)

  for (const u of updates) {
    const { error } = await admin
      .from('matches')
      .update({
        highlightly_match_id: u.highlightly_match_id,
        home_score: u.home_score,
        away_score: u.away_score,
        state: u.state,
      })
      .eq('id', u.id)
    if (error) console.error(`✗ update ${u.id} failed:`, error)
  }

  console.log(`[poll] date=${targetDate} parsed=${parsed.length} updated=${updates.length} unmatched=${unmatched.length}`)
  if (unmatched.length) {
    console.log('[poll] unmatched fixtures:', unmatched.map((p) => `${p.homeTeamName} vs ${p.awayTeamName}`).join(', '))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
