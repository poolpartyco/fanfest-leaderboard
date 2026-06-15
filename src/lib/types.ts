// Shared domain + persistence types for the FanFest leaderboard.
// DB rows use snake_case to mirror the Supabase/Postgres schema.

export type MatchState = 'scheduled' | 'live' | 'finished'

export type UserRow = {
  id: string
  name: string
}

export type TeamRow = {
  id: string
  name: string
  flag: string
  highlightly_team_id: number | null
}

export type MatchRow = {
  id: string
  kickoff: string // ISO 8601 timestamptz
  home_team_id: string
  away_team_id: string
  home_score: number | null
  away_score: number | null
  state: MatchState
  highlightly_match_id: number | null
  // Live status from the API. Optional so older/not-yet-polled rows still type.
  status_clock?: number | null // the match minute the API last reported (e.g. 45)
  status_description?: string | null // raw API status, e.g. "Half time", "Second half"
  status_observed_at?: string | null // ISO time the poller recorded the above
}

export type PickRow = {
  match_id: string
  user_id: string
  picked_team_id: string
}

// A single match parsed from a Highlightly `/matches?date=` response item.
export type ParsedMatch = {
  highlightlyMatchId: number
  kickoff: string // ISO 8601 UTC
  homeTeamHlId: number
  awayTeamHlId: number
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
  state: MatchState
  clock?: number | null // API match minute (state.clock)
  statusDescription?: string | null // raw API status (state.description)
}

// Shape of the legacy bundled JSON (src/data/leaderboard.json).
export type LegacyUser = { id: string; name: string }
export type LegacyTeam = { id: string; name: string; flag: string }
export type LegacyMatch = {
  id: string
  date: string // "11/6"
  hour: string // "14:00"
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  picks: Record<string, string>
}
export type LegacyData = {
  users: LegacyUser[]
  teams: LegacyTeam[]
  matches: LegacyMatch[]
}
