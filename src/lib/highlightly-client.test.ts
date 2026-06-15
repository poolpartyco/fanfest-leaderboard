import { describe, it, expect, vi } from 'vitest'
import { buildMatchesUrl, fetchMatchesByDate, WORLD_CUP_LEAGUE_ID } from './highlightly-client'

describe('buildMatchesUrl', () => {
  it('builds the by-date URL with default World Cup league + season', () => {
    const url = buildMatchesUrl('2026-06-15')
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://soccer.highlightly.net/matches')
    expect(parsed.searchParams.get('leagueId')).toBe(String(WORLD_CUP_LEAGUE_ID))
    expect(parsed.searchParams.get('season')).toBe('2026')
    expect(parsed.searchParams.get('date')).toBe('2026-06-15')
  })

  it('allows overriding league and season', () => {
    const url = buildMatchesUrl('2026-06-15', { leagueId: 999, season: 2022 })
    const parsed = new URL(url)
    expect(parsed.searchParams.get('leagueId')).toBe('999')
    expect(parsed.searchParams.get('season')).toBe('2022')
  })
})

describe('fetchMatchesByDate', () => {
  it('sends the api key headers and returns parsed JSON', async () => {
    const fakeBody = { data: [], plan: { tier: 'BASIC' } }
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => fakeBody,
    })

    const result = await fetchMatchesByDate('2026-06-15', 'KEY123', { fetchImpl })

    expect(result).toEqual(fakeBody)
    const [, init] = fetchImpl.mock.calls[0]
    expect(init.headers['x-api-key']).toBe('KEY123')
    expect(init.headers['x-rapidapi-key']).toBe('KEY123')
  })

  it('throws on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'nope' }),
    })

    await expect(fetchMatchesByDate('2026-06-15', 'KEY123', { fetchImpl })).rejects.toThrow(/403/)
  })
})
