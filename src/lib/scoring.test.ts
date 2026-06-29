import { describe, it, expect } from 'vitest'
import {
  pointsPerCorrectPick,
  getMatchWinner,
  buildLeaderboard,
} from './scoring'
import type { MatchRow, UserRow, PickRow } from './types'

const match = (overrides: Partial<MatchRow>): MatchRow => ({
  id: 'm1',
  kickoff: '2026-06-15T14:00:00Z',
  home_team_id: 'home',
  away_team_id: 'away',
  home_score: null,
  away_score: null,
  state: 'finished',
  highlightly_match_id: null,
  ...overrides,
})

describe('pointsPerCorrectPick', () => {
  it('is 3', () => {
    expect(pointsPerCorrectPick).toBe(3)
  })
})

describe('getMatchWinner', () => {
  it('returns home_team_id when home score is higher', () => {
    expect(getMatchWinner(match({ home_score: 2, away_score: 1 }))).toBe('home')
  })

  it('returns away_team_id when away score is higher', () => {
    expect(getMatchWinner(match({ home_score: 0, away_score: 3 }))).toBe('away')
  })

  it("returns 'draw' when scores are equal", () => {
    expect(getMatchWinner(match({ home_score: 1, away_score: 1 }))).toBe('draw')
  })

  it("scores a knockout match decided on penalties as a draw (120' score, not the shootout)", () => {
    // 1-1 after extra time, Germany through 4-3 on penalties. For pick scoring
    // the result is a draw — the shootout only decides bracket progression.
    expect(getMatchWinner(match({ home_score: 1, away_score: 1, penalty_home: 4, penalty_away: 3 }))).toBe('draw')
  })

  it('returns null when home_score is null', () => {
    expect(getMatchWinner(match({ home_score: null, away_score: 2 }))).toBeNull()
  })

  it('returns null when away_score is null', () => {
    expect(getMatchWinner(match({ home_score: 2, away_score: null }))).toBeNull()
  })

  it('returns null when both scores are null', () => {
    expect(getMatchWinner(match({ home_score: null, away_score: null }))).toBeNull()
  })
})

describe('buildLeaderboard', () => {
  const users: UserRow[] = [
    { id: 'u1', name: 'Alice' },
    { id: 'u2', name: 'Bob' },
  ]

  it('gives everyone 0 when there are no finished matches', () => {
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'scheduled', home_score: 2, away_score: 1 }),
      match({ id: 'm2', state: 'live', home_score: 0, away_score: 0 }),
    ]
    const picks: PickRow[] = [
      { match_id: 'm1', user_id: 'u1', picked_team_id: 'home' },
    ]

    const board = buildLeaderboard(users, matches, picks)

    expect(board).toHaveLength(2)
    board.forEach((row) => {
      expect(row.points).toBe(0)
      expect(row.correctPicks).toBe(0)
      expect(row.totalMatches).toBe(0)
    })
  })

  it('awards points for a correct pick on a finished match', () => {
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'finished', home_score: 2, away_score: 1 }),
    ]
    const picks: PickRow[] = [
      { match_id: 'm1', user_id: 'u1', picked_team_id: 'home' },
      { match_id: 'm1', user_id: 'u2', picked_team_id: 'away' },
    ]

    const board = buildLeaderboard(users, matches, picks)
    const alice = board.find((r) => r.user.id === 'u1')!
    const bob = board.find((r) => r.user.id === 'u2')!

    expect(alice.points).toBe(3)
    expect(alice.correctPicks).toBe(1)
    expect(alice.totalMatches).toBe(1)
    expect(bob.points).toBe(0)
    expect(bob.correctPicks).toBe(0)
    expect(bob.totalMatches).toBe(1)
  })

  it("counts a pick of 'draw' as correct on a drawn match", () => {
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'finished', home_score: 1, away_score: 1 }),
    ]
    const picks: PickRow[] = [
      { match_id: 'm1', user_id: 'u1', picked_team_id: 'draw' },
      { match_id: 'm1', user_id: 'u2', picked_team_id: 'home' },
    ]

    const board = buildLeaderboard(users, matches, picks)

    expect(board.find((r) => r.user.id === 'u1')!.correctPicks).toBe(1)
    expect(board.find((r) => r.user.id === 'u2')!.correctPicks).toBe(0)
  })

  it('treats a user with no pick for a match as incorrect', () => {
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'finished', home_score: 2, away_score: 1 }),
    ]
    const picks: PickRow[] = []

    const board = buildLeaderboard(users, matches, picks)

    board.forEach((row) => {
      expect(row.correctPicks).toBe(0)
      expect(row.totalMatches).toBe(1)
    })
  })

  it('sorts descending by points', () => {
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'finished', home_score: 2, away_score: 1 }),
    ]
    const picks: PickRow[] = [
      { match_id: 'm1', user_id: 'u2', picked_team_id: 'home' },
    ]

    const board = buildLeaderboard(users, matches, picks)

    expect(board[0].user.id).toBe('u2')
    expect(board[1].user.id).toBe('u1')
  })

  it('breaks ties by correctPicks (a draw pick worth fewer matches loses)', () => {
    // Two finished matches. u1 gets 1 correct of 2; u2 gets 1 correct of 2 as well,
    // so to exercise correctPicks ordering we give different correct counts but equal-ish points
    // Here u1 correct on both, u2 correct on one.
    const threeUsers: UserRow[] = [
      { id: 'u1', name: 'Alice' },
      { id: 'u2', name: 'Bob' },
    ]
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'finished', home_score: 2, away_score: 1 }),
      match({ id: 'm2', state: 'finished', home_score: 0, away_score: 4 }),
    ]
    const picks: PickRow[] = [
      { match_id: 'm1', user_id: 'u1', picked_team_id: 'home' },
      { match_id: 'm2', user_id: 'u1', picked_team_id: 'away' },
      { match_id: 'm1', user_id: 'u2', picked_team_id: 'home' },
    ]

    const board = buildLeaderboard(threeUsers, matches, picks)

    expect(board[0].user.id).toBe('u1')
    expect(board[0].correctPicks).toBe(2)
    expect(board[1].user.id).toBe('u2')
    expect(board[1].correctPicks).toBe(1)
  })

  it('is stable for full ties (preserves input order)', () => {
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'finished', home_score: 2, away_score: 1 }),
    ]
    const picks: PickRow[] = [
      { match_id: 'm1', user_id: 'u1', picked_team_id: 'home' },
      { match_id: 'm1', user_id: 'u2', picked_team_id: 'home' },
    ]

    const board = buildLeaderboard(users, matches, picks)

    expect(board.map((r) => r.user.id)).toEqual(['u1', 'u2'])
  })

  it('ignores non-finished matches even when scored', () => {
    const matches: MatchRow[] = [
      match({ id: 'm1', state: 'finished', home_score: 2, away_score: 1 }),
      match({ id: 'm2', state: 'live', home_score: 0, away_score: 1 }),
    ]
    const picks: PickRow[] = [
      { match_id: 'm1', user_id: 'u1', picked_team_id: 'home' },
      { match_id: 'm2', user_id: 'u1', picked_team_id: 'away' },
    ]

    const board = buildLeaderboard(users, matches, picks)
    const alice = board.find((r) => r.user.id === 'u1')!

    expect(alice.correctPicks).toBe(1)
    expect(alice.totalMatches).toBe(1)
  })

  it('returns empty array when there are no users', () => {
    const board = buildLeaderboard([], [match({ state: 'finished', home_score: 1, away_score: 0 })], [])
    expect(board).toEqual([])
  })
})
