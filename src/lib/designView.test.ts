import { describe, it, expect } from 'vitest'
import { winnerSide, pickSide, pickResult, classifyStatus, liveClockLabel } from './designView'
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

describe('classifyStatus', () => {
  it('maps API descriptions to display phases', () => {
    expect(classifyStatus('Not started')).toBe('pre')
    expect(classifyStatus('First half')).toBe('running')
    expect(classifyStatus('Second half')).toBe('running')
    expect(classifyStatus('Extra time')).toBe('running')
    expect(classifyStatus('Half time')).toBe('half-time')
    expect(classifyStatus('Halftime')).toBe('half-time')
    expect(classifyStatus('Penalties')).toBe('break')
    expect(classifyStatus('Finished')).toBe('finished')
    expect(classifyStatus('After Penalties')).toBe('finished')
  })
  it('treats unknown/empty live status as running', () => {
    expect(classifyStatus('')).toBe('running')
    expect(classifyStatus(null)).toBe('running')
  })
})

describe('liveClockLabel', () => {
  const live = (over: Partial<MatchRow>) => m({ state: 'live', ...over })
  // "now" reference for deterministic extrapolation
  const NOW = Date.parse('2026-06-15T23:00:00.000Z')

  it('shows HT during half time, frozen no matter how long ago it was observed', () => {
    const match = live({ status_clock: 45, status_description: 'Half time', status_observed_at: '2026-06-15T22:50:00.000Z' })
    expect(liveClockLabel(match, NOW)).toBe('HT')
  })

  it('shows FT when finished', () => {
    expect(liveClockLabel(live({ status_clock: 90, status_description: 'Finished' }), NOW)).toBe('FT')
  })

  it('extrapolates the running clock forward from the observed time', () => {
    // observed 58' three minutes ago -> 61'
    const match = live({ status_clock: 58, status_description: 'Second half', status_observed_at: '2026-06-15T22:57:00.000Z' })
    expect(liveClockLabel(match, NOW)).toBe("61'")
  })

  it('clamps the first-half clock at 45 so it never ticks into half time', () => {
    // observed 44' ten minutes ago -> raw 54', clamped to 45'
    const match = live({ status_clock: 44, status_description: 'First half', status_observed_at: '2026-06-15T22:50:00.000Z' })
    expect(liveClockLabel(match, NOW)).toBe("45'")
  })

  it('falls back to a kickoff-based estimate when the API status is absent', () => {
    // kickoff 23 min before now, no status fields -> 23'
    const match = live({ kickoff: '2026-06-15T22:37:00.000Z', status_clock: null, status_description: null, status_observed_at: null })
    expect(liveClockLabel(match, NOW)).toBe("23'")
  })
})
