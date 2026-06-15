import { describe, it, expect } from 'vitest'
import { winnerSide, pickSide, pickResult } from './designView'
import type { MatchRow } from './types'

const m = (over: Partial<MatchRow>): MatchRow => ({
  id: 'm', kickoff: '2026-06-15T19:00:00.000Z', home_team_id: 'bel', away_team_id: 'egy',
  home_score: null, away_score: null, state: 'finished', highlightly_match_id: null, ...over,
})

describe('winnerSide', () => {
  it('returns home/away/draw from the scoreline', () => {
    expect(winnerSide(m({ home_score: 2, away_score: 0 }))).toBe('home')
    expect(winnerSide(m({ home_score: 0, away_score: 1 }))).toBe('away')
    expect(winnerSide(m({ home_score: 1, away_score: 1 }))).toBe('draw')
  })
  it('returns null when not yet played', () => {
    expect(winnerSide(m({ home_score: null, away_score: null }))).toBeNull()
  })
})

describe('pickSide', () => {
  const match = m({ home_team_id: 'bel', away_team_id: 'egy' })
  it('maps a picked team id to home/away, and the draw sentinel to draw', () => {
    expect(pickSide(match, 'bel')).toBe('home')
    expect(pickSide(match, 'egy')).toBe('away')
    expect(pickSide(match, 'draw')).toBe('draw')
  })
  it('returns null for no pick or an unrelated team', () => {
    expect(pickSide(match, undefined)).toBeNull()
    expect(pickSide(match, 'esp')).toBeNull()
  })
})

describe('pickResult', () => {
  it('correct when pick side matches the winner side', () => {
    expect(pickResult('home', 'home')).toBe('correct')
  })
  it('wrong when sides differ', () => {
    expect(pickResult('away', 'home')).toBe('wrong')
    expect(pickResult('draw', 'home')).toBe('wrong')
  })
  it('none when there is no pick', () => {
    expect(pickResult(null, 'home')).toBe('none')
  })
})
