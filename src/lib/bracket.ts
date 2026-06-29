// Bracket progression: derive who advanced from each finished knockout match
// and propagate winners (and the semi-final losers) into the next round's
// slots. Pure functions over MatchRow[], so the poller and tests share them.
import type { MatchRow, SourceResult } from './types'

/**
 * The team that advanced from a finished knockout match. The 120-minute score
 * decides it; if that's level the match went to penalties, so the shootout
 * (penalty_home/away) breaks the tie. Returns null only when still level with
 * no shootout recorded — then it must be set manually via advanced_team_id.
 *
 * Note this is bracket progression only: pick scoring uses the drawn score, so
 * a penalty result here never turns a level game into a "win" for points.
 */
export function advancedTeamId(m: MatchRow): string | null {
  if (m.state !== 'finished') return null
  if (m.home_score == null || m.away_score == null) return null
  if (m.home_team_id == null || m.away_team_id == null) return null
  if (m.home_score > m.away_score) return m.home_team_id
  if (m.away_score > m.home_score) return m.away_team_id
  // Level after 120' → decided on penalties.
  if (m.penalty_home != null && m.penalty_away != null) {
    if (m.penalty_home > m.penalty_away) return m.home_team_id
    if (m.penalty_away > m.penalty_home) return m.away_team_id
  }
  return null
}

// Effective advance: an explicit advanced_team_id (e.g. a penalty winner set by
// hand) wins; otherwise derive it from the score.
function effectiveAdvanced(m: MatchRow): string | null {
  return m.advanced_team_id ?? advancedTeamId(m)
}

// The team that did NOT advance, for the third-place feed.
function loserTeamId(m: MatchRow): string | null {
  const adv = effectiveAdvanced(m)
  if (adv == null || m.home_team_id == null || m.away_team_id == null) return null
  return adv === m.home_team_id ? m.away_team_id : m.home_team_id
}

function fromSource(src: MatchRow | undefined, result: SourceResult | null | undefined): string | null {
  if (!src || !result) return null
  return result === 'winner' ? effectiveAdvanced(src) : loserTeamId(src)
}

export type BracketResolution = {
  id: string
  home_team_id?: string
  away_team_id?: string
  advanced_team_id?: string
}

/**
 * Given the full set of matches, return the updates needed so unresolved
 * knockout slots take their feeder's winner/loser and each decided knockout
 * match records who advanced. Only includes rows that actually change.
 */
export function resolveBracket(matches: MatchRow[]): BracketResolution[] {
  const byId = new Map(matches.map((m) => [m.id, m]))
  const out: BracketResolution[] = []

  for (const m of matches) {
    if (m.stage !== 'knockout') continue
    const res: BracketResolution = { id: m.id }
    let changed = false

    if (m.home_team_id == null && m.home_source_match_id) {
      const t = fromSource(byId.get(m.home_source_match_id), m.home_source_result)
      if (t) {
        res.home_team_id = t
        changed = true
      }
    }
    if (m.away_team_id == null && m.away_source_match_id) {
      const t = fromSource(byId.get(m.away_source_match_id), m.away_source_result)
      if (t) {
        res.away_team_id = t
        changed = true
      }
    }
    // Record the team that advanced once the match is decided on the score.
    if (m.advanced_team_id == null) {
      const adv = advancedTeamId(m)
      if (adv) {
        res.advanced_team_id = adv
        changed = true
      }
    }

    if (changed) out.push(res)
  }

  return out
}
