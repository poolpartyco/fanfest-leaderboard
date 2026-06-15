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
