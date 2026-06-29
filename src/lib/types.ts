// Shared domain + persistence types for the FanFest leaderboard.
// DB rows use snake_case to mirror the Supabase/Postgres schema.

export type MatchState = 'scheduled' | 'live' | 'finished'

// Tournament stage + knockout round. Group matches use stage 'group' and a null
// round; knockout matches carry a round that drives the bracket layout.
export type MatchStage = 'group' | 'knockout'
export type KnockoutRound = 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'third'
// Which result of a feeder match flows into a slot: the winner advances, the
// loser drops to the third-place play-off.
export type SourceResult = 'winner' | 'loser'

export type UserRow = {
  id: string
  name: string
  // Google account this player signs in with. Null for rows not yet linked.
  email?: string | null
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
  // Null while a knockout slot is unresolved (the feeder match hasn't finished).
  home_team_id: string | null
  away_team_id: string | null
  home_score: number | null
  away_score: number | null
  state: MatchState
  highlightly_match_id: number | null
  // Live status from the API. Optional so older/not-yet-polled rows still type.
  status_clock?: number | null // the match minute the API last reported (e.g. 45)
  status_description?: string | null // raw API status, e.g. "Half time", "Second half"
  status_observed_at?: string | null // ISO time the poller recorded the above
  // Bracket structure. Group rows default to stage 'group' with null round.
  stage?: MatchStage
  round?: KnockoutRound | null
  bracket_order?: number | null // position within a round, for deterministic layout
  // Feeder graph: which match's winner/loser fills each slot (null for R32).
  home_source_match_id?: string | null
  away_source_match_id?: string | null
  home_source_result?: SourceResult | null
  away_source_result?: SourceResult | null
  // Team that actually progressed (handles extra time / penalties), independent
  // of the 90-minute home/away_score used for pick scoring.
  advanced_team_id?: string | null
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
  round?: string | null // raw API round, e.g. "Group Stage - 1" / "Round of 16"
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

// Shape of the bundled knockout fixtures (src/data/knockout.json). Round-of-32
// rows carry real team ids; later rounds carry a feeder reference instead.
export type KnockoutSource = { matchId: string; result: SourceResult }
export type KnockoutMatch = {
  id: string
  round: KnockoutRound
  date: string // Bogota-local "D/M"
  hour: string // "HH:MM"
  bracketOrder: number
  homeTeamId?: string | null
  awayTeamId?: string | null
  homeSource?: KnockoutSource
  awaySource?: KnockoutSource
}
export type KnockoutData = { matches: KnockoutMatch[] }
