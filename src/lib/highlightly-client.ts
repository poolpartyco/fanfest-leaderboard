// Thin HTTP client for the Highlightly Soccer API.
// Pure URL building is unit-tested; the network call takes an injectable fetch.

export const HIGHLIGHTLY_BASE = 'https://soccer.highlightly.net'
export const WORLD_CUP_LEAGUE_ID = 1635
export const WORLD_CUP_SEASON = 2026

export function buildMatchesUrl(
  date: string,
  opts: { leagueId?: number; season?: number } = {},
): string {
  const leagueId = opts.leagueId ?? WORLD_CUP_LEAGUE_ID
  const season = opts.season ?? WORLD_CUP_SEASON
  const url = new URL(`${HIGHLIGHTLY_BASE}/matches`)
  url.searchParams.set('leagueId', String(leagueId))
  url.searchParams.set('season', String(season))
  url.searchParams.set('date', date)
  return url.toString()
}

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

export async function fetchMatchesByDate(
  date: string,
  apiKey: string,
  opts: { leagueId?: number; season?: number; fetchImpl?: FetchLike } = {},
): Promise<unknown> {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike)
  const url = buildMatchesUrl(date, opts)
  const res = await fetchImpl(url, {
    headers: { 'x-api-key': apiKey, 'x-rapidapi-key': apiKey },
  })
  if (!res.ok) {
    throw new Error(`Highlightly request failed: HTTP ${res.status}`)
  }
  return res.json()
}
