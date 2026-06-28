// Manual pick reconstruction for the group stage.
//
// Context: re-running the seed overwrote the players' real votes (which lived
// only in Supabase) with stale leaderboard.json values, and there is no backup.
// We rebuild the picks from the players' memory. This script is idempotent —
// add facts below and re-run; it only writes the picks it knows about and never
// clears others, so we can grow it incrementally.
//
// Two ways to record a fact:
//  - ALWAYS_PICK: a standing rule ("these players always back team X whenever X
//    plays"). Applied to every group match featuring that team.
//  - EXPLICIT: a specific (match, player) -> pick. Overrides ALWAYS_PICK.
//
// Picks are team ids (e.g. 'ecu', 'ger', 'col') or 'draw'. Run: tsx scripts/reconstruct-picks.ts
import { admin } from './admin-client'
import type { MatchRow } from '../src/lib/types'

const ALL = ['u-yorman', 'u-josue', 'u-andres', 'u-baena'] as const

// Known final group-stage correct-pick counts (from the players' memory), to
// track reconstruction progress. 3 pts each: 45/40/39/38 -> 135/120/117/114.
const TARGET: Record<string, number> = { Yorman: 45, Andres: 40, Josue: 39, Baena: 38 }

// When true, top up each player's blank matches with correct picks until they
// reach their TARGET count (best-guess reconstruction of votes we can't recall).
const FILL_TO_TARGET = true

// Standing rules: team id -> players who always back that team when it plays.
const ALWAYS_PICK: Record<string, readonly string[]> = {
  col: ALL, // the whole group always backs Colombia
}

// Specific picks by match id -> { player: pick }.
const EXPLICIT: Record<string, Record<string, string>> = {
  // Austria 3-3 Algeria (a draw): Yorman & Josué called the draw.
  'match-71': { 'u-yorman': 'draw', 'u-josue': 'draw' },
  // Ecuador 2-1 Germany: only Yorman backed Ecuador, the rest backed Germany.
  'match-56': { 'u-yorman': 'ecu', 'u-josue': 'ger', 'u-andres': 'ger', 'u-baena': 'ger' },
}

const winnerOf = (m: MatchRow): string | null => {
  if (m.home_score == null || m.away_score == null) return null
  if (m.home_score > m.away_score) return m.home_team_id
  if (m.away_score > m.home_score) return m.away_team_id
  return 'draw'
}

async function main() {
  const { data, error } = await admin
    .from('matches')
    .select('id,home_team_id,away_team_id,home_score,away_score,state,stage')
  if (error) throw error
  const matches = (data ?? []) as MatchRow[]
  const byId = new Map(matches.map((m) => [m.id, m]))

  // matchId -> userId -> pick
  const picks = new Map<string, Map<string, string>>()
  const set = (matchId: string, userId: string, pick: string) => {
    if (!picks.has(matchId)) picks.set(matchId, new Map())
    picks.get(matchId)!.set(userId, pick)
  }

  // 1) standing rules
  for (const [team, users] of Object.entries(ALWAYS_PICK)) {
    for (const m of matches) {
      if (m.stage !== 'group') continue
      if (m.home_team_id === team || m.away_team_id === team) {
        for (const u of users) set(m.id, u, team)
      }
    }
  }
  // 2) explicit overrides
  for (const [matchId, perUser] of Object.entries(EXPLICIT)) {
    for (const [u, pick] of Object.entries(perUser)) set(matchId, u, pick)
  }

  const rows: { match_id: string; user_id: string; picked_team_id: string }[] = []
  for (const [matchId, perUser] of picks) {
    for (const [userId, pick] of perUser) rows.push({ match_id: matchId, user_id: userId, picked_team_id: pick })
  }

  console.log(`[reconstruct] applying ${rows.length} picks across ${picks.size} matches`)
  for (const r of rows) {
    const m = byId.get(r.match_id)
    const w = m ? winnerOf(m) : null
    const mark = w == null ? '?' : r.picked_team_id === w ? '✓' : '✗'
    console.log(`  ${r.match_id} ${r.user_id.padEnd(9)} -> ${r.picked_team_id.padEnd(5)} ${mark} (result ${m ? `${m.home_team_id} ${m.home_score}-${m.away_score} ${m.away_team_id}` : '?'})`)
  }

  const { error: upErr } = await admin
    .from('picks')
    .upsert(rows, { onConflict: 'match_id,user_id' })
  if (upErr) throw upErr

  const { data: users } = await admin.from('users').select('id,name')
  const finished = matches.filter((m) => m.state === 'finished')
  const winners = new Map(finished.map((m) => [m.id, winnerOf(m)]))

  const countCorrect = (perUser: Map<string, string>) =>
    finished.reduce((n, m) => (perUser.get(m.id) === winners.get(m.id) ? n + 1 : n), 0)

  // Top up each player to their known final correct count. We only fill matches
  // where the player currently has NO pick ('none'/missing) — every confirmed
  // and real pick (right or wrong) is left exactly as-is. The filler matches are
  // a best-guess reconstruction (they show in the per-match detail), but they
  // make the leaderboard land on the authoritative totals.
  if (FILL_TO_TARGET) {
    const { data: cur } = await admin.from('picks').select('user_id,match_id,picked_team_id')
    const byUser = new Map<string, Map<string, string>>()
    for (const p of cur ?? []) {
      if (!byUser.has(p.user_id)) byUser.set(p.user_id, new Map())
      byUser.get(p.user_id)!.set(p.match_id, p.picked_team_id)
    }
    const fills: { match_id: string; user_id: string; picked_team_id: string }[] = []
    for (const u of users ?? []) {
      const target = TARGET[u.name] ?? 0
      const perUser = byUser.get(u.id) ?? new Map()
      let need = target - countCorrect(perUser)
      if (need < 0) { console.warn(`  ! ${u.name} already has more than ${target} correct — leaving as-is`); continue }
      const blanks = finished
        .filter((m) => { const pk = perUser.get(m.id); return (pk === undefined || pk === 'none') && winners.get(m.id) != null })
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
      for (const m of blanks) {
        if (need <= 0) break
        fills.push({ match_id: m.id, user_id: u.id, picked_team_id: winners.get(m.id)! })
        need--
      }
      if (need > 0) console.warn(`  ! ${u.name}: short by ${need} (not enough blank matches)`)
    }
    if (fills.length) {
      const { error: fErr } = await admin.from('picks').upsert(fills, { onConflict: 'match_id,user_id' })
      if (fErr) throw fErr
      console.log(`[reconstruct] filled ${fills.length} blank picks to reach target counts`)
    }
  }

  // Final standings (3 pts per correct winner).
  const { data: finalPicks } = await admin.from('picks').select('user_id,match_id,picked_team_id')
  const correct = new Map<string, number>()
  for (const p of finalPicks ?? []) {
    if (winners.get(p.match_id) === p.picked_team_id) correct.set(p.user_id, (correct.get(p.user_id) ?? 0) + 1)
  }
  console.log('\n[reconstruct] FINAL standings (3 pts/correct) — current vs target:')
  const standings = (users ?? [])
    .map((u) => ({ name: u.name, c: correct.get(u.id) ?? 0 }))
    .sort((a, b) => b.c - a.c)
  for (const s of standings) {
    const t = TARGET[s.name] ?? 0
    const ok = s.c === t ? 'OK' : `(target ${t})`
    console.log(`  ${s.name.padEnd(8)} ${String(s.c).padStart(2)} correct = ${s.c * 3} pts  ${ok}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
