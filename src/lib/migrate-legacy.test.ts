import { legacyToRows } from './migrate-legacy'
import type { LegacyData } from './types'

function baseData(overrides: Partial<LegacyData> = {}): LegacyData {
  return {
    users: [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ],
    teams: [
      { id: 't1', name: 'Brazil', flag: '🇧🇷' },
      { id: 't2', name: 'Argentina', flag: '🇦🇷' },
    ],
    matches: [
      {
        id: 'm1',
        date: '11/6',
        hour: '14:00',
        homeTeamId: 't1',
        awayTeamId: 't2',
        homeScore: 2,
        awayScore: 1,
        picks: { u1: 't1', u2: 't2' },
      },
    ],
    ...overrides,
  }
}

describe('legacyToRows users', () => {
  it('maps users straight across', () => {
    const { users } = legacyToRows(baseData(), { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(users).toEqual([
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ])
  })
})

describe('legacyToRows teams', () => {
  it('maps id/name/flag and sets highlightly_team_id to null', () => {
    const { teams } = legacyToRows(baseData(), { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(teams).toEqual([
      { id: 't1', name: 'Brazil', flag: '🇧🇷', highlightly_team_id: null },
      { id: 't2', name: 'Argentina', flag: '🇦🇷', highlightly_team_id: null },
    ])
  })
})

describe('legacyToRows kickoff parsing', () => {
  it('converts Bogota local (UTC-5) "11/6" 14:00 to UTC ISO', () => {
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(matches[0].kickoff).toBe('2026-06-11T19:00:00.000Z')
  })

  it('parses single-digit day and month', () => {
    const data = baseData({
      matches: [
        {
          id: 'm1',
          date: '1/7',
          hour: '09:00',
          homeTeamId: 't1',
          awayTeamId: 't2',
          homeScore: 0,
          awayScore: 0,
          picks: {},
        },
      ],
    })
    const { matches } = legacyToRows(data, { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(matches[0].kickoff).toBe('2026-07-01T14:00:00.000Z')
  })

  it('respects a custom year', () => {
    const { matches } = legacyToRows(baseData(), { year: 2025, now: new Date('2025-06-12T00:00:00.000Z') })
    expect(matches[0].kickoff).toBe('2025-06-11T19:00:00.000Z')
  })
})

describe('legacyToRows match state', () => {
  it('marks a match finished when kickoff+150min <= now', () => {
    // kickoff 19:00Z, +150min = 21:30Z; now after that
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-11T21:30:00.000Z') })
    expect(matches[0].state).toBe('finished')
  })

  it('keeps legacy scores when finished', () => {
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(matches[0].state).toBe('finished')
    expect(matches[0].home_score).toBe(2)
    expect(matches[0].away_score).toBe(1)
  })

  it('marks a match live when kickoff <= now < kickoff+150min', () => {
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-11T20:00:00.000Z') })
    expect(matches[0].state).toBe('live')
    expect(matches[0].home_score).toBeNull()
    expect(matches[0].away_score).toBeNull()
  })

  it('marks a match scheduled when now < kickoff and nulls scores', () => {
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-11T18:00:00.000Z') })
    expect(matches[0].state).toBe('scheduled')
    expect(matches[0].home_score).toBeNull()
    expect(matches[0].away_score).toBeNull()
  })

  it('treats exact kickoff instant as live (boundary)', () => {
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-11T19:00:00.000Z') })
    expect(matches[0].state).toBe('live')
  })

  it('treats exact kickoff+150min instant as finished (boundary)', () => {
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-11T21:30:00.000Z') })
    expect(matches[0].state).toBe('finished')
  })
})

describe('legacyToRows match mapping', () => {
  it('maps team ids and nulls highlightly_match_id', () => {
    const { matches } = legacyToRows(baseData(), { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(matches[0].id).toBe('m1')
    expect(matches[0].home_team_id).toBe('t1')
    expect(matches[0].away_team_id).toBe('t2')
    expect(matches[0].highlightly_match_id).toBeNull()
  })
})

describe('legacyToRows picks explosion', () => {
  it('explodes picks into one row per user', () => {
    const { picks } = legacyToRows(baseData(), { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(picks).toEqual([
      { match_id: 'm1', user_id: 'u1', picked_team_id: 't1' },
      { match_id: 'm1', user_id: 'u2', picked_team_id: 't2' },
    ])
  })

  it('counts picks across multiple matches', () => {
    const data = baseData({
      matches: [
        {
          id: 'm1',
          date: '11/6',
          hour: '14:00',
          homeTeamId: 't1',
          awayTeamId: 't2',
          homeScore: 2,
          awayScore: 1,
          picks: { u1: 't1', u2: 't2' },
        },
        {
          id: 'm2',
          date: '12/6',
          hour: '14:00',
          homeTeamId: 't2',
          awayTeamId: 't1',
          homeScore: 0,
          awayScore: 0,
          picks: { u1: 't2' },
        },
      ],
    })
    const { picks } = legacyToRows(data, { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(picks).toHaveLength(3)
  })

  it('returns no picks for an empty picks record', () => {
    const data = baseData({
      matches: [
        {
          id: 'm1',
          date: '11/6',
          hour: '14:00',
          homeTeamId: 't1',
          awayTeamId: 't2',
          homeScore: 0,
          awayScore: 0,
          picks: {},
        },
      ],
    })
    const { picks } = legacyToRows(data, { now: new Date('2026-06-12T00:00:00.000Z') })
    expect(picks).toEqual([])
  })
})

describe('legacyToRows empty input', () => {
  it('handles empty data', () => {
    const { users, teams, matches, picks } = legacyToRows(
      { users: [], teams: [], matches: [] },
      { now: new Date('2026-06-12T00:00:00.000Z') },
    )
    expect(users).toEqual([])
    expect(teams).toEqual([])
    expect(matches).toEqual([])
    expect(picks).toEqual([])
  })
})
