// Maps local team ids to Highlightly team ids and reconciles parsed API
// fixtures against our match rows. Derived from the WC 2026 /standings response
// (src/lib/__fixtures__/standings.json) — exact ids, no fragile name matching.

import type { MatchRow, MatchState, ParsedMatch } from './types'

export const HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID: Record<string, number> = {
  mex: 14400, // Mexico
  kor: 15251, // South Korea
  cze: 656054, // Czech Republic
  rsa: 1303665, // South Africa
  sui: 13549, // Switzerland
  can: 4705963, // Canada
  qat: 1336003, // Qatar
  bih: 947947, // Bosnia & Herzegovina
  sco: 943692, // Scotland
  mar: 27165, // Morocco
  bra: 5890, // Brazil
  hai: 2031270, // Haiti
  usa: 2029568, // USA
  aus: 17804, // Australia
  tur: 662011, // Turkey
  par: 2026164, // Paraguay
  ger: 22059, // Germany
  civ: 1278135, // Ivory Coast (local "Côte d'Ivoire")
  ecu: 2027866, // Ecuador
  cur: 4706814, // Curaçao
  swe: 5039, // Sweden
  jpn: 10996, // Japan
  ned: 952202, // Netherlands
  tun: 24612, // Tunisia
  bel: 1635, // Belgium
  egy: 28016, // Egypt
  irn: 19506, // Iran (local "IR Iran")
  nzl: 3977507, // New Zealand
  esp: 8443, // Spain
  cpv: 1305367, // Cape Verde (local "Cabo Verde")
  ksa: 20357, // Saudi Arabia
  uru: 6741, // Uruguay
  fra: 2486, // France
  sen: 11847, // Senegal
  irq: 1334301, // Iraq
  nor: 928374, // Norway
  arg: 22910, // Argentina
  alg: 1304516, // Algeria
  aut: 660309, // Austria
  jor: 1318132, // Jordan
  por: 23761, // Portugal
  cod: 1284092, // Congo DR
  uzb: 1335152, // Uzbekistan
  col: 7592, // Colombia
  eng: 9294, // England
  cro: 3337, // Croatia
  gha: 1280688, // Ghana
  pan: 10145, // Panama
}

export function localIdByHighlightlyTeamId(): Map<number, string> {
  const map = new Map<number, string>()
  for (const [localId, hlId] of Object.entries(HIGHLIGHTLY_TEAM_ID_BY_LOCAL_ID)) {
    map.set(hlId, localId)
  }
  return map
}

export type MatchUpdate = {
  id: string
  highlightly_match_id: number
  home_score: number | null
  away_score: number | null
  state: MatchState
}

export function reconcileMatches(
  parsedMatches: ParsedMatch[],
  ourMatches: MatchRow[],
): { updates: MatchUpdate[]; unmatched: ParsedMatch[] } {
  const reverse = localIdByHighlightlyTeamId()
  const byHlId = new Map<number, MatchRow>()
  for (const m of ourMatches) {
    if (m.highlightly_match_id !== null) byHlId.set(m.highlightly_match_id, m)
  }

  const updates: MatchUpdate[] = []
  const unmatched: ParsedMatch[] = []

  for (const p of parsedMatches) {
    const homeLocal = reverse.get(p.homeTeamHlId)
    const awayLocal = reverse.get(p.awayTeamHlId)

    // 1) already linked by highlightly_match_id
    let target = byHlId.get(p.highlightlyMatchId)

    // 2) otherwise match by team pair (order-insensitive), nearest kickoff
    if (!target && homeLocal && awayLocal) {
      const pair = new Set([homeLocal, awayLocal])
      const candidates = ourMatches.filter(
        (m) => m.highlightly_match_id === null && new Set([m.home_team_id, m.away_team_id]).size === 2 &&
          m.home_team_id !== m.away_team_id && pair.has(m.home_team_id) && pair.has(m.away_team_id),
      )
      if (candidates.length > 0) {
        const pk = new Date(p.kickoff).getTime()
        target = candidates.reduce((best, m) =>
          Math.abs(new Date(m.kickoff).getTime() - pk) < Math.abs(new Date(best.kickoff).getTime() - pk) ? m : best,
        )
      }
    }

    if (!target || !homeLocal || !awayLocal) {
      unmatched.push(p)
      continue
    }

    // Align scores to OUR home/away orientation.
    const sameOrientation = target.home_team_id === homeLocal
    updates.push({
      id: target.id,
      highlightly_match_id: p.highlightlyMatchId,
      home_score: sameOrientation ? p.homeScore : p.awayScore,
      away_score: sameOrientation ? p.awayScore : p.homeScore,
      state: p.state,
    })
  }

  return { updates, unmatched }
}
