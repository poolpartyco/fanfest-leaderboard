import { knockoutToRows } from './migrate-legacy'
import knockoutData from '../data/knockout.json'
import type { KnockoutData } from './types'

const data = knockoutData as KnockoutData
const now = new Date('2026-06-28T12:00:00.000Z')

describe('knockoutToRows', () => {
  it('produces one knockout row per fixture (M73-M104 + third place)', () => {
    const rows = knockoutToRows(data, { now })
    expect(rows).toHaveLength(32)
    expect(rows.every((r) => r.stage === 'knockout')).toBe(true)
    expect(rows.every((r) => r.home_score === null && r.away_score === null)).toBe(true)
  })

  it('keeps real teams + null feeders for a Round-of-32 match', () => {
    const m73 = knockoutToRows(data, { now }).find((r) => r.id === 'M73')!
    expect(m73.round).toBe('r32')
    expect(m73.home_team_id).toBe('rsa')
    expect(m73.away_team_id).toBe('can')
    expect(m73.home_source_match_id).toBeNull()
    // 28/6 14:00 Bogota (UTC-5) -> 19:00 UTC
    expect(m73.kickoff).toBe('2026-06-28T19:00:00.000Z')
  })

  it('keeps null teams + a feeder graph for a later-round match', () => {
    const m89 = knockoutToRows(data, { now }).find((r) => r.id === 'M89')!
    expect(m89.round).toBe('r16')
    expect(m89.home_team_id).toBeNull()
    expect(m89.away_team_id).toBeNull()
    expect(m89.home_source_match_id).toBe('M74')
    expect(m89.home_source_result).toBe('winner')
    expect(m89.away_source_match_id).toBe('M77')
  })

  it('feeds semi-final losers into the third-place play-off', () => {
    const m103 = knockoutToRows(data, { now }).find((r) => r.id === 'M103')!
    expect(m103.round).toBe('third')
    expect(m103.home_source_result).toBe('loser')
    expect(m103.away_source_result).toBe('loser')
  })

  it('every feeder reference points at a real earlier match', () => {
    const rows = knockoutToRows(data, { now })
    const ids = new Set(rows.map((r) => r.id))
    for (const r of rows) {
      if (r.home_source_match_id) expect(ids.has(r.home_source_match_id)).toBe(true)
      if (r.away_source_match_id) expect(ids.has(r.away_source_match_id)).toBe(true)
    }
  })
})
