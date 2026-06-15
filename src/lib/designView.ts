// Pure helpers mapping our DB rows onto the design's home/draw/away model.
import type { MatchRow } from './types'

export type Side = 'home' | 'away' | 'draw'
export type PickOutcome = 'correct' | 'wrong' | 'none'

export function winnerSide(match: MatchRow): Side | null {
  if (match.home_score === null || match.away_score === null) return null
  if (match.home_score > match.away_score) return 'home'
  if (match.away_score > match.home_score) return 'away'
  return 'draw'
}

export function pickSide(match: MatchRow, pickedTeamId: string | undefined): Side | null {
  if (pickedTeamId === undefined) return null
  if (pickedTeamId === 'draw') return 'draw'
  if (pickedTeamId === match.home_team_id) return 'home'
  if (pickedTeamId === match.away_team_id) return 'away'
  return null
}

export function pickResult(pick: Side | null, winner: Side | null): PickOutcome {
  if (pick === null) return 'none'
  return pick === winner ? 'correct' : 'wrong'
}

// Convert a chosen side back to the team id stored in `picks.picked_team_id`.
export function sideToTeamId(match: MatchRow, side: Side): string {
  if (side === 'home') return match.home_team_id
  if (side === 'away') return match.away_team_id
  return 'draw'
}

// ----- Live clock display -----------------------------------------------------
// The API gives us an authoritative match minute (`status_clock`) plus a status
// `description` ("Half time", "Second half", "Finished", …). We map that to a
// display phase and a label, instead of guessing the minute from wall-clock —
// which used to keep ticking straight through half-time.

export type LivePhase = 'pre' | 'running' | 'half-time' | 'break' | 'finished'

export function classifyStatus(description: string | null | undefined): LivePhase {
  const d = (description ?? '').trim().toLowerCase()
  if (d === '') return 'running' // live but unlabelled → assume play is on
  if (d.includes('not started') || d === 'tbd' || d === 'scheduled') return 'pre'
  // Check "finished"/post-match before the generic running fallthrough.
  if (
    d.includes('finish') || d.includes('full time') || d.includes('ended') ||
    d.includes('after ') || d.includes('aet') || d.includes('awarded') ||
    d.includes('cancel') || d.includes('abandon')
  ) return 'finished'
  if (d.includes('half time') || d.includes('halftime') || d === 'ht' || d.includes('break')) return 'half-time'
  if (d.includes('penal')) return 'break' // shoot-out pause; no running minute
  return 'running'
}

// Cap an extrapolated minute to the current period so it can't run past the
// whistle into the next phase (e.g. a first-half clock never shows 46').
function runningCap(base: number): number {
  if (base <= 45) return 45
  if (base <= 90) return 90
  return 120
}

/**
 * Label for the live banner: "HT", "FT", or a minute like "61'".
 * Uses the API status when present, extrapolating the running minute forward
 * from when it was observed; falls back to a kickoff-based estimate for rows
 * that haven't been polled since this status was introduced.
 */
export function liveClockLabel(match: MatchRow, nowMs: number): string {
  const hasStatus = match.status_description != null || match.status_clock != null
  if (!hasStatus) {
    const m = Math.min(90, Math.max(1, Math.floor((nowMs - Date.parse(match.kickoff)) / 60_000)))
    return `${m}'`
  }

  const phase = classifyStatus(match.status_description)
  if (phase === 'finished') return 'FT'
  if (phase === 'half-time') return 'HT'
  if (phase === 'break') return 'PEN'
  if (phase === 'pre') return ''

  const base = match.status_clock ?? 0
  let minute = base
  if (match.status_observed_at) {
    const elapsed = Math.floor((nowMs - Date.parse(match.status_observed_at)) / 60_000)
    if (elapsed > 0) minute = base + elapsed
  }
  minute = Math.max(1, Math.min(runningCap(base), minute))
  return `${minute}'`
}
