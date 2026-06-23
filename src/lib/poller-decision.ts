// Pure decision logic for the budget-aware cron poller. No I/O.

import type { MatchRow } from './types'

export const LIVE_WINDOW_MINUTES = 150
export const DAILY_CAP = 100
export const MIN_POLL_INTERVAL_MINUTES = 7

/**
 * True when kickoff <= now <= kickoff + windowMinutes (inclusive of both bounds).
 */
export function isInLiveWindow(
  kickoff: string,
  now: Date,
  windowMinutes: number = LIVE_WINDOW_MINUTES
): boolean {
  const start = new Date(kickoff).getTime()
  const end = start + windowMinutes * 60_000
  const t = now.getTime()
  return t >= start && t <= end
}

/**
 * A match we should keep polling: not finished, and either inside its kickoff
 * window or still flagged `live` in our DB. The latter covers delayed matches
 * that run past the nominal window — we keep polling until the API says
 * finished, instead of freezing a stale score.
 */
function isLiveNow(m: MatchRow, now: Date, windowMinutes: number = LIVE_WINDOW_MINUTES): boolean {
  if (m.state === 'finished') return false
  return m.state === 'live' || isInLiveWindow(m.kickoff, now, windowMinutes)
}

const utcDate = (iso: string) => new Date(iso).toISOString().slice(0, 10) // YYYY-MM-DD (UTC)

/**
 * The distinct UTC dates we must fetch to refresh every currently-live match.
 * The Highlightly `/matches` endpoint is indexed by a single UTC date, so two
 * concurrent matches that straddle UTC midnight (e.g. a 21:00Z and a 00:00Z
 * kickoff) live on different dates and each needs its own request. Same-day
 * concurrent matches dedupe to one date — and thus one call. Falls back to
 * `[today]` for the daily-discovery run when nothing is live.
 */
export function liveTargetDates(
  matches: MatchRow[],
  now: Date,
  today: string,
  windowMinutes: number = LIVE_WINDOW_MINUTES,
): string[] {
  const dates = new Set<string>()
  for (const m of matches) {
    if (isLiveNow(m, now, windowMinutes)) dates.add(utcDate(m.kickoff))
  }
  return dates.size > 0 ? [...dates].sort() : [today]
}

export type PollDecision = { poll: boolean; reason: string }

export function shouldPoll(params: {
  matches: MatchRow[]
  now: Date
  requestCountToday: number
  lastPolledAt: string | null
  dailyCap?: number
  minIntervalMinutes?: number
}): PollDecision {
  const {
    matches,
    now,
    requestCountToday,
    lastPolledAt,
    dailyCap = DAILY_CAP,
    minIntervalMinutes = MIN_POLL_INTERVAL_MINUTES,
  } = params

  if (requestCountToday >= dailyCap) {
    return { poll: false, reason: 'daily-cap-reached' }
  }

  if (requestCountToday === 0) {
    return { poll: true, reason: 'daily-discovery' }
  }

  if (!matches.some((m) => isLiveNow(m, now))) {
    return { poll: false, reason: 'no-live-match' }
  }

  if (lastPolledAt !== null) {
    const elapsedMinutes = (now.getTime() - new Date(lastPolledAt).getTime()) / 60_000
    if (elapsedMinutes < minIntervalMinutes) {
      return { poll: false, reason: 'throttled' }
    }
  }

  return { poll: true, reason: 'live-match' }
}
