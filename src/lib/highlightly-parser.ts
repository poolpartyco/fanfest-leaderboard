// Pure parsers for the Highlightly `/matches?date=` response.
import type { MatchState, ParsedMatch } from './types'

/**
 * Parse a Highlightly score string like "0 - 1" into numeric home/away.
 * Tolerant of extra whitespace. null/undefined/empty -> { home: null, away: null }.
 */
export function parseScore(current: string | null | undefined): {
  home: number | null
  away: number | null
} {
  if (current == null) return { home: null, away: null }
  const trimmed = current.trim()
  if (trimmed === '') return { home: null, away: null }

  const match = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
  if (!match) return { home: null, away: null }

  return { home: Number(match[1]), away: Number(match[2]) }
}

/**
 * Map a Highlightly state description to our MatchState.
 * "Not started" -> scheduled, "Finished" -> finished, everything else -> live.
 * Case-insensitive and whitespace-tolerant.
 */
export function mapState(description: string): MatchState {
  const normalized = (description ?? '').trim().toLowerCase()
  if (normalized === 'not started') return 'scheduled'
  if (normalized === 'finished') return 'finished'
  return 'live'
}

/**
 * Parse a full Highlightly by-date response into ParsedMatch[].
 * Tolerates missing/empty data and skips items lacking an id.
 */
export function parseMatchesResponse(json: unknown): ParsedMatch[] {
  if (json == null || typeof json !== 'object') return []

  const data = (json as { data?: unknown }).data
  if (!Array.isArray(data)) return []

  const result: ParsedMatch[] = []
  for (const raw of data) {
    if (raw == null || typeof raw !== 'object') continue
    const item = raw as Record<string, any>
    if (item.id == null) continue

    const score = parseScore(item.state?.score?.current)
    const rawClock = item.state?.clock
    const clock = typeof rawClock === 'number' ? rawClock : null
    const description = typeof item.state?.description === 'string' ? item.state.description : null
    const round = typeof item.round === 'string' ? item.round : null

    result.push({
      highlightlyMatchId: item.id,
      kickoff: item.date,
      homeTeamHlId: item.homeTeam?.id,
      awayTeamHlId: item.awayTeam?.id,
      homeTeamName: item.homeTeam?.name,
      awayTeamName: item.awayTeam?.name,
      homeScore: score.home,
      awayScore: score.away,
      state: mapState(item.state?.description),
      clock,
      statusDescription: description,
      round,
    })
  }

  return result
}
