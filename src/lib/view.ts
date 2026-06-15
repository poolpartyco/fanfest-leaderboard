// Pure view helpers for shaping DB rows into what the UI renders.
import type { MatchRow, PickRow, UserRow } from './types'

const byKickoffAsc = (a: MatchRow, b: MatchRow) =>
  new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()

export function partitionMatches(matches: MatchRow[]): {
  live: MatchRow[]
  past: MatchRow[]
  upcoming: MatchRow[]
} {
  return {
    live: matches.filter((m) => m.state === 'live').sort(byKickoffAsc),
    past: matches.filter((m) => m.state === 'finished').sort((a, b) => -byKickoffAsc(a, b)),
    upcoming: matches.filter((m) => m.state === 'scheduled').sort(byKickoffAsc),
  }
}

// Format a UTC ISO kickoff for display in Bogota local time (UTC-5).
export function formatKickoffBogota(iso: string): { day: string; time: string } {
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  // Match the legacy "D/M" convention (no zero-padding on the date).
  return { day: `${Number(get('day'))}/${Number(get('month'))}`, time: `${get('hour')}:${get('minute')}` }
}

export function buildPicksByMatch(picks: PickRow[]): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {}
  for (const p of picks) {
    ;(out[p.match_id] ??= {})[p.user_id] = p.picked_team_id
  }
  return out
}

// Group a single match's picks by the chosen team id, preserving user order.
export function groupPicks(
  picksForMatch: Record<string, string> | undefined,
  users: UserRow[],
): { teamId: string; userNames: string[] }[] {
  const groups = new Map<string, string[]>()
  for (const user of users) {
    const teamId = picksForMatch?.[user.id]
    if (teamId === undefined) continue
    const list = groups.get(teamId) ?? []
    list.push(user.name)
    groups.set(teamId, list)
  }
  return Array.from(groups.entries()).map(([teamId, userNames]) => ({ teamId, userNames }))
}
