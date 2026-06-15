import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseScore, mapState, parseMatchesResponse } from './highlightly-parser'

const fixture = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__', 'matches-by-date.json'), 'utf-8'),
)

describe('parseScore', () => {
  it('parses "0 - 1" into home 0 and away 1', () => {
    expect(parseScore('0 - 1')).toEqual({ home: 0, away: 1 })
  })

  it('parses multi-digit scores like "5 - 1"', () => {
    expect(parseScore('5 - 1')).toEqual({ home: 5, away: 1 })
  })

  it('tolerates extra spaces around and between numbers', () => {
    expect(parseScore('  2   -   3  ')).toEqual({ home: 2, away: 3 })
  })

  it('returns nulls for null', () => {
    expect(parseScore(null)).toEqual({ home: null, away: null })
  })

  it('returns nulls for undefined', () => {
    expect(parseScore(undefined)).toEqual({ home: null, away: null })
  })

  it('returns nulls for empty string', () => {
    expect(parseScore('')).toEqual({ home: null, away: null })
  })
})

describe('mapState', () => {
  it('maps "Not started" to scheduled', () => {
    expect(mapState('Not started')).toBe('scheduled')
  })

  it('maps "Finished" to finished', () => {
    expect(mapState('Finished')).toBe('finished')
  })

  it('maps "Second half" to live', () => {
    expect(mapState('Second half')).toBe('live')
  })

  it('maps "First half", "Halftime", "Extra time", "Penalties" to live', () => {
    expect(mapState('First half')).toBe('live')
    expect(mapState('Halftime')).toBe('live')
    expect(mapState('Extra time')).toBe('live')
    expect(mapState('Penalties')).toBe('live')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(mapState('  not STARTED ')).toBe('scheduled')
    expect(mapState(' FINISHED ')).toBe('finished')
  })
})

describe('parseMatchesResponse', () => {
  it('maps every fixture item to a ParsedMatch', () => {
    const result = parseMatchesResponse(fixture)
    expect(result).toHaveLength(4)
  })

  it('maps the Not-started item to scheduled with null scores', () => {
    const result = parseMatchesResponse(fixture)
    const match = result.find((m) => m.highlightlyMatchId === 1267462313)!
    expect(match).toMatchObject({
      highlightlyMatchId: 1267462313,
      kickoff: '2026-06-15T22:00:00.000Z',
      homeTeamHlId: 20357,
      awayTeamHlId: 6741,
      homeTeamName: 'Saudi Arabia',
      awayTeamName: 'Uruguay',
      homeScore: null,
      awayScore: null,
      state: 'scheduled',
    })
  })

  it('maps the live "Second half" item to live with parsed score', () => {
    const result = parseMatchesResponse(fixture)
    const match = result.find((m) => m.highlightlyMatchId === 1267460611)!
    expect(match).toMatchObject({
      homeTeamName: 'Belgium',
      awayTeamName: 'Egypt',
      homeScore: 0,
      awayScore: 1,
      state: 'live',
    })
  })

  it('maps the Finished items to finished with parsed scores', () => {
    const result = parseMatchesResponse(fixture)
    const spain = result.find((m) => m.highlightlyMatchId === 1267463164)!
    expect(spain).toMatchObject({
      homeScore: 0,
      awayScore: 0,
      state: 'finished',
    })
    const sweden = result.find((m) => m.highlightlyMatchId === 1309691486)!
    expect(sweden).toMatchObject({
      homeScore: 5,
      awayScore: 1,
      state: 'finished',
    })
  })

  it('returns [] for empty data array', () => {
    expect(parseMatchesResponse({ data: [] })).toEqual([])
  })

  it('returns [] for missing data', () => {
    expect(parseMatchesResponse({})).toEqual([])
  })

  it('returns [] for null/undefined/non-object input', () => {
    expect(parseMatchesResponse(null)).toEqual([])
    expect(parseMatchesResponse(undefined)).toEqual([])
    expect(parseMatchesResponse('nope')).toEqual([])
  })

  it('skips items lacking an id', () => {
    const json = {
      data: [
        { date: '2026-01-01T00:00:00.000Z', homeTeam: { id: 1, name: 'A' }, awayTeam: { id: 2, name: 'B' }, state: { description: 'Not started', score: { current: null } } },
        { id: 99, date: '2026-01-01T00:00:00.000Z', homeTeam: { id: 1, name: 'A' }, awayTeam: { id: 2, name: 'B' }, state: { description: 'Finished', score: { current: '1 - 0' } } },
      ],
    }
    const result = parseMatchesResponse(json)
    expect(result).toHaveLength(1)
    expect(result[0].highlightlyMatchId).toBe(99)
  })
})
