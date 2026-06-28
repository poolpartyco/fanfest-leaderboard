// One-off recovery: rebuild group-stage match results from Highlightly.
//
// Re-running `npm run seed` against the live DB overwrites the matches table
// from the bundled leaderboard.json, whose group scores are mostly placeholder
// 0-0 (the real results were filled in by the poller, never written back to the
// file). This refetches every group-stage date from Highlightly and reconciles
// the true scores back in — exactly what the poller does, but for past dates and
// without the live-window / daily-cap gating. Knockout rows are left untouched.
import { admin } from './admin-client'
import { fetchMatchesByDate } from '../src/lib/highlightly-client'
import { parseMatchesResponse } from '../src/lib/highlightly-parser'
import { reconcileMatches } from '../src/lib/reconcile'
import type { MatchRow, ParsedMatch } from '../src/lib/types'

const utcDate = (iso: string) => new Date(iso).toISOString().slice(0, 10)

async function main() {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY
  if (!apiKey) throw new Error('Missing HIGHLIGHTLY_API_KEY')

  const { data, error } = await admin
    .from('matches')
    .select('id,kickoff,home_team_id,away_team_id,home_score,away_score,state,highlightly_match_id,stage')
  if (error) throw error
  const rows = (data ?? []) as MatchRow[]
  // Only restore group fixtures; knockout rows are seeded fresh and correct.
  const group = rows.filter((m) => (m.stage ?? 'group') === 'group')

  const dates = [...new Set(group.map((m) => utcDate(m.kickoff)))].sort()
  console.log(`[recover] ${group.length} group matches across ${dates.length} dates: ${dates.join(', ')}`)

  const parsed: ParsedMatch[] = []
  for (const date of dates) {
    const json = await fetchMatchesByDate(date, apiKey)
    const items = parseMatchesResponse(json)
    parsed.push(...items)
    console.log(`[recover] ${date}: ${items.length} fixtures`)
  }

  const { updates, unmatched } = reconcileMatches(parsed, group)
  console.log(`[recover] reconciled ${updates.length} updates, ${unmatched.length} unmatched`)

  const now = new Date().toISOString()
  let applied = 0
  for (const u of updates) {
    const { error: uErr } = await admin
      .from('matches')
      .update({
        highlightly_match_id: u.highlightly_match_id,
        home_score: u.home_score,
        away_score: u.away_score,
        state: u.state,
        status_clock: u.status_clock,
        status_description: u.status_description,
        status_observed_at: now,
      })
      .eq('id', u.id)
    if (uErr) console.error(`✗ update ${u.id} failed:`, uErr)
    else applied++
  }

  console.log(`[recover] applied ${applied}/${updates.length} updates`)
  if (unmatched.length) {
    console.log('[recover] UNMATCHED (not restored):', unmatched.map((p) => `${p.homeTeamName} v ${p.awayTeamName}`).join(', '))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
