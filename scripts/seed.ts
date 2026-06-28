// One-time seed: load the legacy bundled JSON into Supabase, attaching the
// authoritative Highlightly team ids. Idempotent via upserts.
import { admin } from './admin-client'
import legacyData from '../src/data/leaderboard.json'
import knockoutData from '../src/data/knockout.json'
import { legacyToRows, knockoutToRows } from '../src/lib/migrate-legacy'
import { HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID } from '../src/lib/reconcile'
import type { KnockoutData, LegacyData } from '../src/lib/types'

async function main() {
  const now = new Date()
  const { users, teams, matches: groupMatches, picks } = legacyToRows(legacyData as unknown as LegacyData, { now })
  // Knockout fixtures: group rows first, then the bracket ordered so each
  // feeder reference (FK to matches.id) points at an already-listed match.
  const knockoutMatches = knockoutToRows(knockoutData as unknown as KnockoutData, { now })
  const matches = [...groupMatches, ...knockoutMatches]

  const teamsWithHl = teams.map((t) => ({
    ...t,
    highlightly_team_id: HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID[t.id] ?? null,
  }))

  // Order matters for foreign keys: users + teams -> matches -> picks.
  const steps: Array<[string, () => PromiseLike<{ error: unknown }>]> = [
    ['users', () => admin.from('users').upsert(users)],
    ['teams', () => admin.from('teams').upsert(teamsWithHl)],
    ['matches', () => admin.from('matches').upsert(matches)],
    ['picks', () => admin.from('picks').upsert(picks)],
  ]

  for (const [name, run] of steps) {
    const { error } = await run()
    if (error) {
      console.error(`✗ seeding ${name} failed:`, error)
      process.exit(1)
    }
    const counts: Record<string, number> = {
      users: users.length,
      teams: teamsWithHl.length,
      matches: matches.length,
      picks: picks.length,
    }
    console.log(`✓ ${name}: ${counts[name]} rows`)
  }

  console.log('Seed complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
