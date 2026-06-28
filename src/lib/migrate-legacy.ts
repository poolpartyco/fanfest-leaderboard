// Transform the legacy bundled JSON (LegacyData) into DB rows.
// Kickoff times are interpreted in America/Bogota (fixed UTC-5, no DST).

import type {
  KnockoutData,
  LegacyData,
  MatchRow,
  MatchState,
  PickRow,
  TeamRow,
  UserRow,
} from './types'

const BOGOTA_OFFSET_HOURS = 5 // UTC-5, fixed (no DST)
const MATCH_DURATION_MS = 150 * 60 * 1000

// Parse a legacy "D/M" date + "HH:MM" hour (Bogota local) into a UTC ISO string.
function bogotaToUtcIso(date: string, hour: string, year: number): string {
  const [day, month] = date.split('/').map((n) => Number(n))
  const [hh, mm] = hour.split(':').map((n) => Number(n))
  // Local Bogota time is UTC-5, so the UTC instant is local + 5 hours.
  const utcMs = Date.UTC(year, month - 1, day, hh + BOGOTA_OFFSET_HOURS, mm, 0, 0)
  return new Date(utcMs).toISOString()
}

function stateForKickoff(kickoffIso: string, now: Date): MatchState {
  const kickoffMs = new Date(kickoffIso).getTime()
  const nowMs = now.getTime()
  if (kickoffMs + MATCH_DURATION_MS <= nowMs) return 'finished'
  if (kickoffMs <= nowMs) return 'live'
  return 'scheduled'
}

export function legacyToRows(
  data: LegacyData,
  opts: { year?: number; now: Date },
): { users: UserRow[]; teams: TeamRow[]; matches: MatchRow[]; picks: PickRow[] } {
  const year = opts.year ?? 2026

  const users: UserRow[] = data.users.map((u) => ({ id: u.id, name: u.name }))

  const teams: TeamRow[] = data.teams.map((t) => ({
    id: t.id,
    name: t.name,
    flag: t.flag,
    highlightly_team_id: null,
  }))

  const matches: MatchRow[] = []
  const picks: PickRow[] = []

  for (const m of data.matches) {
    const kickoff = bogotaToUtcIso(m.date, m.hour, year)
    const state = stateForKickoff(kickoff, opts.now)
    const finished = state === 'finished'

    matches.push({
      id: m.id,
      kickoff,
      home_team_id: m.homeTeamId,
      away_team_id: m.awayTeamId,
      home_score: finished ? m.homeScore : null,
      away_score: finished ? m.awayScore : null,
      state,
      highlightly_match_id: null,
      stage: 'group',
    })

    for (const [userId, teamId] of Object.entries(m.picks)) {
      picks.push({ match_id: m.id, user_id: userId, picked_team_id: teamId })
    }
  }

  return { users, teams, matches, picks }
}

// Transform the bundled knockout fixtures into match rows. Round-of-32 rows
// carry real teams; later rounds start with null team slots plus the feeder
// graph (which match's winner/loser fills each slot). Scores stay null — the
// poller fills them and `resolveBracket` propagates winners forward.
export function knockoutToRows(
  data: KnockoutData,
  opts: { year?: number; now: Date },
): MatchRow[] {
  const year = opts.year ?? 2026

  return data.matches.map((m) => {
    const kickoff = bogotaToUtcIso(m.date, m.hour, year)
    return {
      id: m.id,
      kickoff,
      home_team_id: m.homeTeamId ?? null,
      away_team_id: m.awayTeamId ?? null,
      home_score: null,
      away_score: null,
      state: stateForKickoff(kickoff, opts.now),
      highlightly_match_id: null,
      stage: 'knockout',
      round: m.round,
      bracket_order: m.bracketOrder,
      home_source_match_id: m.homeSource?.matchId ?? null,
      away_source_match_id: m.awaySource?.matchId ?? null,
      home_source_result: m.homeSource?.result ?? null,
      away_source_result: m.awaySource?.result ?? null,
      advanced_team_id: null,
    }
  })
}
