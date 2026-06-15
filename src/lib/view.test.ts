import { describe, it, expect } from 'vitest'
import { partitionMatches, formatKickoffBogota, buildPicksByMatch, groupPicks } from './view'
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
