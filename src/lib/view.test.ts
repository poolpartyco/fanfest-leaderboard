import { describe, it, expect } from 'vitest'
import { partitionMatches, formatKickoffBogota, buildPicksByMatch, groupPicks, bogotaDayKey, voteDayMatches, formatCountdown } from './view'
import type { MatchRow, PickRow, UserRow } from './types'

const m = (over: Partial<MatchRow>): MatchRow => ({
  id: 'm', kickoff: '2026-06-15T19:00:00.000Z', home_team_id: 'bel', away_team_id: 'egy',
  home_score: null, away_score: null, state: 'scheduled', highlightly_match_id: null, ...over,
})

describe('partitionMatches', () => {
  it('splits by state, past newest-first and upcoming soonest-first', () => {
    const matches = [
      m({ id: 'live', state: 'live' }),
      m({ id: 'old', state: 'finished', kickoff: '2026-06-10T19:00:00.000Z' }),
      m({ id: 'recent', state: 'finished', kickoff: '2026-06-14T19:00:00.000Z' }),
      m({ id: 'soon', state: 'scheduled', kickoff: '2026-06-16T19:00:00.000Z' }),
      m({ id: 'later', state: 'scheduled', kickoff: '2026-06-18T19:00:00.000Z' }),
    ]
    const { live, past, upcoming } = partitionMatches(matches)
    expect(live.map((x) => x.id)).toEqual(['live'])
    expect(past.map((x) => x.id)).toEqual(['recent', 'old'])
    expect(upcoming.map((x) => x.id)).toEqual(['soon', 'later'])
  })
})

describe('formatKickoffBogota', () => {
  it('renders a UTC kickoff in Bogota local time (UTC-5)', () => {
    expect(formatKickoffBogota('2026-06-11T19:00:00.000Z')).toEqual({ day: '11/6', time: '14:00' })
  })
  it('rolls back across midnight UTC', () => {
    // 02:00Z on the 16th is 21:00 on the 15th in Bogota
    expect(formatKickoffBogota('2026-06-16T02:00:00.000Z')).toEqual({ day: '15/6', time: '21:00' })
  })
})

describe('bogotaDayKey', () => {
  it('returns the YYYY-MM-DD calendar day in Bogota (UTC-5)', () => {
    expect(bogotaDayKey('2026-06-15T19:00:00.000Z')).toBe('2026-06-15') // 14:00 Bogota
  })
  it('rolls back across midnight UTC', () => {
    // 02:00Z on the 16th is still the 15th in Bogota
    expect(bogotaDayKey('2026-06-16T02:00:00.000Z')).toBe('2026-06-15')
  })
})

describe('voteDayMatches', () => {
  const today = m({ id: 'today', kickoff: '2026-06-15T22:00:00.000Z' })   // 17:00 Bogota 15/6
  const todayLate = m({ id: 'today2', kickoff: '2026-06-16T01:00:00.000Z' }) // 20:00 Bogota 15/6
  const tomorrow = m({ id: 'tmrw', kickoff: '2026-06-16T19:00:00.000Z' })  // 14:00 Bogota 16/6

  it('keeps only matches on the current Bogota day when today has fixtures', () => {
    const now = new Date('2026-06-15T15:00:00.000Z') // 10:00 Bogota 15/6
    expect(voteDayMatches([tomorrow, today, todayLate], now).map((x) => x.id)).toEqual(['today', 'today2'])
  })

  it('falls back to the soonest upcoming day when today has none', () => {
    const now = new Date('2026-06-14T15:00:00.000Z') // 14/6, no fixtures that day
    expect(voteDayMatches([tomorrow, today], now).map((x) => x.id)).toEqual(['today'])
  })

  it('returns [] when there are no upcoming matches', () => {
    expect(voteDayMatches([], new Date('2026-06-15T15:00:00.000Z'))).toEqual([])
  })
})

describe('formatCountdown', () => {
  const ms = (h: number, m: number, s: number) => ((h * 60 + m) * 60 + s) * 1000
  it('shows "Locked" at or past zero', () => {
    expect(formatCountdown(0)).toBe('Locked')
    expect(formatCountdown(-5000)).toBe('Locked')
  })
  it('shows days + hours when more than a day out', () => {
    expect(formatCountdown(ms(51, 0, 0))).toBe('2d 3h')
  })
  it('shows hours + zero-padded minutes under a day', () => {
    expect(formatCountdown(ms(2, 14, 30))).toBe('2h 14m')
    expect(formatCountdown(ms(1, 5, 0))).toBe('1h 05m')
  })
  it('shows minutes + zero-padded seconds under an hour', () => {
    expect(formatCountdown(ms(0, 14, 5))).toBe('14m 05s')
  })
  it('shows just seconds under a minute', () => {
    expect(formatCountdown(ms(0, 0, 45))).toBe('45s')
  })
})

describe('buildPicksByMatch / groupPicks', () => {
  const users: UserRow[] = [
    { id: 'u-a', name: 'Ana' }, { id: 'u-b', name: 'Beto' }, { id: 'u-c', name: 'Caro' },
  ]
  const picks: PickRow[] = [
    { match_id: 'm1', user_id: 'u-a', picked_team_id: 'bel' },
    { match_id: 'm1', user_id: 'u-b', picked_team_id: 'bel' },
    { match_id: 'm1', user_id: 'u-c', picked_team_id: 'draw' },
  ]

  it('indexes picks by match then user', () => {
    expect(buildPicksByMatch(picks)).toEqual({
      m1: { 'u-a': 'bel', 'u-b': 'bel', 'u-c': 'draw' },
    })
  })

  it('groups a match by chosen team, keeping user order', () => {
    const byMatch = buildPicksByMatch(picks)
    expect(groupPicks(byMatch.m1, users)).toEqual([
      { teamId: 'bel', userNames: ['Ana', 'Beto'] },
      { teamId: 'draw', userNames: ['Caro'] },
    ])
  })

  it('omits users with no pick for the match', () => {
    expect(groupPicks({ 'u-a': 'bel' }, users)).toEqual([{ teamId: 'bel', userNames: ['Ana'] }])
    expect(groupPicks(undefined, users)).toEqual([])
  })
})
