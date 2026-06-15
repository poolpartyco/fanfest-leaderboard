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

  const hasLiveMatch = matches.some(
    (m) => m.state !== 'finished' && isInLiveWindow(m.kickoff, now)
  )
  if (!hasLiveMatch) {
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
