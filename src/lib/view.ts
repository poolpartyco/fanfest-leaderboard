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

// The YYYY-MM-DD calendar day a kickoff falls on in Bogota local time.
export function bogotaDayKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// Matches to surface in the Vote tab: only the current Bogota day's fixtures,
// so players aren't scrolling the whole tournament. If today has none (all
// kicked off, or an off day), fall back to the soonest upcoming matchday so the
// tab is never empty.
export function voteDayMatches(upcoming: MatchRow[], now: Date): MatchRow[] {
  if (upcoming.length === 0) return []
  const sorted = [...upcoming].sort(byKickoffAsc)
  const todayKey = bogotaDayKey(now.toISOString())
  const todays = sorted.filter((m) => bogotaDayKey(m.kickoff) === todayKey)
  if (todays.length > 0) return todays
  const firstKey = bogotaDayKey(sorted[0].kickoff)
  return sorted.filter((m) => bogotaDayKey(m.kickoff) === firstKey)
}

// Human-readable time remaining until kickoff. Coarse when far out (days/hours),
// precise when close (seconds), so a 1s tick stays meaningful near the deadline.
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Locked'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${pad(m)}m`
  if (m > 0) return `${m}m ${pad(s)}s`
  return `${s}s`
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
