import { describe, it, expect } from 'vitest'
import {
  HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID,
  localIdByHighlightlyTeamId,
  reconcileMatches,
} from './reconcile'
import type { MatchRow, ParsedMatch } from './types'

describe('team id mapping', () => {
  it('maps the live-match teams to their Highlightly ids', () => {
    expect(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID.bel).toBe(1635)
    expect(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID.egy).toBe(28016)
    expect(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID.cpv).toBe(1305367) // "Cape Verde" vs local "Cabo Verde"
    expect(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID.rsa).toBe(1303665) // "South Africa" vs local "Sudáfrica"
  })

  it('covers all 48 real teams and excludes the draw/none pseudo-teams', () => {
    expect(Object.keys(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID)).toHaveLength(48)
    expect(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID.draw).toBeUndefined()
    expect(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID.none).toBeUndefined()
  })

  it('reverse lookup resolves Highlightly id back to the local id', () => {
    expect(localIdByHighlightlyTeamId().get(28016)).toBe('egy')
  })
})

const match = (over: Partial<MatchRow>): MatchRow => ({
  id: 'm',
  kickoff: '2026-06-15T19:00:00.000Z',
  home_team_id: 'bel',
  away_team_id: 'egy',
  home_score: null,
  away_score: null,
  state: 'scheduled',
  highlightly_match_id: null,
  ...over,
})

const parsed = (over: Partial<ParsedMatch>): ParsedMatch => ({
  highlightlyMatchId: 1267460611,
  kickoff: '2026-06-15T19:00:00.000Z',
  homeTeamHlId: 1635, // Belgium
  awayTeamHlId: 28016, // Egypt
  homeTeamName: 'Belgium',
  awayTeamName: 'Egypt',
  homeScore: 0,
  awayScore: 1,
  state: 'live',
  ...over,
})

describe('reconcileMatches', () => {
  it('matches on an already-known highlightly_match_id', () => {
    const our = [match({ id: 'match-12', highlightly_match_id: 1267460611, home_team_id: 'bel', away_team_id: 'egy' })]
    const { updates, unmatched } = reconcileMatches([parsed({})], our)
    expect(unmatched).toHaveLength(0)
    expect(updates).toEqual([
      { id: 'match-12', highlightly_match_id: 1267460611, home_score: 0, away_score: 1, state: 'live' },
    ])
  })

  it('matches by team pair when no highlightly id is set yet, aligning scores to our orientation', () => {
    const our = [match({ id: 'match-12', home_team_id: 'bel', away_team_id: 'egy' })]
    const { updates } = reconcileMatches([parsed({})], our)
    expect(updates[0]).toMatchObject({ id: 'match-12', highlightly_match_id: 1267460611, home_score: 0, away_score: 1 })
  })

  it('swaps scores when our home/away orientation is reversed vs the API', () => {
    // our match has Egypt at home, API has Belgium at home
    const our = [match({ id: 'match-12', home_team_id: 'egy', away_team_id: 'bel' })]
    const { updates } = reconcileMatches([parsed({})], our)
    // API: Belgium(home)=0, Egypt(away)=1 -> our home is Egypt so home_score must be 1
    expect(updates[0]).toMatchObject({ id: 'match-12', home_score: 1, away_score: 0 })
  })

  it('reports unmatched when no local fixture has the team pair', () => {
    const our = [match({ id: 'match-1', home_team_id: 'mex', away_team_id: 'rsa' })]
    const { updates, unmatched } = reconcileMatches([parsed({})], our)
    expect(updates).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
  })

  it('disambiguates two fixtures of the same pair by closest kickoff', () => {
    const groupGame = match({ id: 'grp', home_team_id: 'bel', away_team_id: 'egy', kickoff: '2026-06-15T19:00:00.000Z' })
    const knockout = match({ id: 'ko', home_team_id: 'bel', away_team_id: 'egy', kickoff: '2026-07-02T19:00:00.000Z' })
    const { updates } = reconcileMatches([parsed({ kickoff: '2026-07-02T19:05:00.000Z' })], [groupGame, knockout])
    expect(updates[0].id).toBe('ko')
  })
})
