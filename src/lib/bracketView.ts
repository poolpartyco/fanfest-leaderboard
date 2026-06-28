// View helpers shared by the knockout bracket tab and the inline Road-to-Glory
// band. Keeps round labels, winner derivation, and slot placeholders in one place.
import type { KnockoutRound, MatchRow, SourceResult } from './types'
import { advancedTeamId } from './bracket'

export const ROUND_LABEL: Record<KnockoutRound, string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-final',
  sf: 'Semi-final',
  final: 'Final',
  third: 'Third place',
}

// The rounds shown as selectable steps in the inline band, in tournament order.
export const ROUND_FLOW: KnockoutRound[] = ['r32', 'r16', 'qf', 'sf', 'final']

// Team that advanced from a knockout match, for winner highlighting: an explicit
// advanced_team_id (penalty winner) wins, else the 90-minute score decides.
export function bracketWinnerTeamId(m: MatchRow): string | null {
  return m.advanced_team_id ?? advancedTeamId(m)
}

// Label for an unresolved slot: the winner of a feeder reads "W74", a
// semi-final loser dropping to the third-place match reads "RU101".
export function slotPlaceholder(
  sourceMatchId: string | null | undefined,
  result: SourceResult | null | undefined,
): string {
  if (!sourceMatchId) return 'TBD'
  const num = sourceMatchId.replace(/^M/, '')
  return (result === 'loser' ? 'RU' : 'W') + num
}

// Only knockout matches with both teams resolved are votable / surfaced in the
// Vote and Upcoming tabs; unresolved slots wait for their feeder to finish.
export function hasBothTeams(m: MatchRow): boolean {
  return m.home_team_id != null && m.away_team_id != null
}
