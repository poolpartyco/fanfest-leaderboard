import { advancedTeamId, resolveBracket } from './bracket'
import type { MatchRow } from './types'

// Minimal match-row factory; only the fields the bracket logic reads matter.
function ko(partial: Partial<MatchRow> & { id: string }): MatchRow {
  return {
    kickoff: '2026-07-01T00:00:00.000Z',
    home_team_id: null,
    away_team_id: null,
    home_score: null,
    away_score: null,
    state: 'scheduled',
    highlightly_match_id: null,
    stage: 'knockout',
    round: 'r32',
    ...partial,
  }
}

describe('advancedTeamId', () => {
  it('returns the higher-scoring team when finished', () => {
    expect(advancedTeamId(ko({ id: 'M73', home_team_id: 'rsa', away_team_id: 'can', home_score: 2, away_score: 1, state: 'finished' }))).toBe('rsa')
    expect(advancedTeamId(ko({ id: 'M73', home_team_id: 'rsa', away_team_id: 'can', home_score: 0, away_score: 3, state: 'finished' }))).toBe('can')
  })
  it('returns null for a draw (penalties decide it, set manually)', () => {
    expect(advancedTeamId(ko({ id: 'M73', home_team_id: 'rsa', away_team_id: 'can', home_score: 1, away_score: 1, state: 'finished' }))).toBeNull()
  })
  it('returns null when not finished or scores missing', () => {
    expect(advancedTeamId(ko({ id: 'M73', home_team_id: 'rsa', away_team_id: 'can', home_score: 2, away_score: 1, state: 'live' }))).toBeNull()
    expect(advancedTeamId(ko({ id: 'M73', home_team_id: 'rsa', away_team_id: 'can', state: 'finished' }))).toBeNull()
  })
})

describe('resolveBracket', () => {
  it('fills a winner into the next-round home slot and records the advance', () => {
    const m73 = ko({ id: 'M73', home_team_id: 'rsa', away_team_id: 'can', home_score: 2, away_score: 1, state: 'finished' })
    const m90 = ko({ id: 'M90', round: 'r16', home_source_match_id: 'M73', home_source_result: 'winner', away_source_match_id: 'M75', away_source_result: 'winner' })
    const updates = resolveBracket([m73, m90])
    expect(updates).toContainEqual({ id: 'M73', advanced_team_id: 'rsa' })
    expect(updates).toContainEqual({ id: 'M90', home_team_id: 'rsa' })
  })

  it('feeds a semi-final loser into the third-place play-off', () => {
    const m101 = ko({ id: 'M101', round: 'sf', home_team_id: 'bra', away_team_id: 'fra', home_score: 0, away_score: 2, state: 'finished' })
    const m103 = ko({ id: 'M103', round: 'third', home_source_match_id: 'M101', home_source_result: 'loser', away_source_match_id: 'M102', away_source_result: 'loser' })
    const updates = resolveBracket([m101, m103])
    expect(updates.find((u) => u.id === 'M103')).toEqual({ id: 'M103', home_team_id: 'bra' })
  })

  it('prefers an explicit advanced_team_id (penalty winner) over the score', () => {
    const m74 = ko({ id: 'M74', home_team_id: 'ger', away_team_id: 'par', home_score: 1, away_score: 1, state: 'finished', advanced_team_id: 'par' })
    const m89 = ko({ id: 'M89', round: 'r16', home_source_match_id: 'M74', home_source_result: 'winner' })
    const updates = resolveBracket([m74, m89])
    expect(updates.find((u) => u.id === 'M89')).toEqual({ id: 'M89', home_team_id: 'par' })
  })

  it('does not re-resolve an already-filled slot or touch group matches', () => {
    const group = ko({ id: 'g1', stage: 'group', home_team_id: 'mex', away_team_id: 'rsa', home_score: 2, away_score: 0, state: 'finished' })
    const m90 = ko({ id: 'M90', round: 'r16', home_team_id: 'rsa', home_source_match_id: 'M73', home_source_result: 'winner' })
    expect(resolveBracket([group, m90])).toEqual([])
  })

  it('leaves a slot unresolved while its feeder is unfinished', () => {
    const m73 = ko({ id: 'M73', home_team_id: 'rsa', away_team_id: 'can', state: 'live' })
    const m90 = ko({ id: 'M90', round: 'r16', home_source_match_id: 'M73', home_source_result: 'winner' })
    expect(resolveBracket([m73, m90])).toEqual([])
  })
})
