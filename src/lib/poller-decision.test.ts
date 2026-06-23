import {
  LIVE_WINDOW_MINUTES,
  DAILY_CAP,
  MIN_POLL_INTERVAL_MINUTES,
  isInLiveWindow,
  shouldPoll,
  liveTargetDates,
} from './poller-decision'
import type { MatchRow } from './types'

function makeMatch(overrides: Partial<MatchRow> = {}): MatchRow {
  return {
    id: 'm1',
    kickoff: '2026-06-15T14:00:00Z',
    home_team_id: 'h',
    away_team_id: 'a',
    home_score: null,
    away_score: null,
    state: 'scheduled',
    highlightly_match_id: null,
    ...overrides,
  }
}

describe('constants', () => {
  it('exposes the documented defaults', () => {
    expect(LIVE_WINDOW_MINUTES).toBe(150)
    expect(DAILY_CAP).toBe(100)
    expect(MIN_POLL_INTERVAL_MINUTES).toBe(7)
  })
})

describe('isInLiveWindow', () => {
  const kickoff = '2026-06-15T14:00:00Z'

  it('is true at exactly the kickoff time (lower boundary)', () => {
    expect(isInLiveWindow(kickoff, new Date('2026-06-15T14:00:00Z'))).toBe(true)
  })

  it('is true partway through the window', () => {
    expect(isInLiveWindow(kickoff, new Date('2026-06-15T15:00:00Z'))).toBe(true)
  })

  it('is true at exactly kickoff + windowMinutes (upper boundary)', () => {
    expect(isInLiveWindow(kickoff, new Date('2026-06-15T16:30:00Z'))).toBe(true)
  })

  it('is false just after the window closes', () => {
    expect(isInLiveWindow(kickoff, new Date('2026-06-15T16:30:01Z'))).toBe(false)
  })

  it('is false before kickoff', () => {
    expect(isInLiveWindow(kickoff, new Date('2026-06-15T13:59:59Z'))).toBe(false)
  })

  it('honors a custom windowMinutes', () => {
    expect(isInLiveWindow(kickoff, new Date('2026-06-15T14:30:00Z'), 30)).toBe(true)
    expect(isInLiveWindow(kickoff, new Date('2026-06-15T14:30:01Z'), 30)).toBe(false)
  })
})

describe('shouldPoll', () => {
  const now = new Date('2026-06-15T15:00:00Z')
  const liveMatch = makeMatch({ kickoff: '2026-06-15T14:00:00Z', state: 'live' })

  it('returns daily-cap-reached when count >= cap, even with a live match', () => {
    const result = shouldPoll({
      matches: [liveMatch],
      now,
      requestCountToday: DAILY_CAP,
      lastPolledAt: null,
    })
    expect(result).toEqual({ poll: false, reason: 'daily-cap-reached' })
  })

  it('respects a custom dailyCap', () => {
    const result = shouldPoll({
      matches: [liveMatch],
      now,
      requestCountToday: 5,
      lastPolledAt: null,
      dailyCap: 5,
    })
    expect(result).toEqual({ poll: false, reason: 'daily-cap-reached' })
  })

  it('returns daily-discovery when this is the first call of the day', () => {
    const result = shouldPoll({
      matches: [],
      now,
      requestCountToday: 0,
      lastPolledAt: null,
    })
    expect(result).toEqual({ poll: true, reason: 'daily-discovery' })
  })

  it('returns no-live-match when no match is in its live window', () => {
    const future = makeMatch({ kickoff: '2026-06-15T20:00:00Z', state: 'scheduled' })
    const result = shouldPoll({
      matches: [future],
      now,
      requestCountToday: 3,
      lastPolledAt: null,
    })
    expect(result).toEqual({ poll: false, reason: 'no-live-match' })
  })

  it('does not count a finished match inside its time window as live', () => {
    const finished = makeMatch({ kickoff: '2026-06-15T14:00:00Z', state: 'finished' })
    const result = shouldPoll({
      matches: [finished],
      now,
      requestCountToday: 3,
      lastPolledAt: null,
    })
    expect(result).toEqual({ poll: false, reason: 'no-live-match' })
  })

  it('returns throttled when last poll was within the min interval', () => {
    const result = shouldPoll({
      matches: [liveMatch],
      now,
      requestCountToday: 3,
      lastPolledAt: '2026-06-15T14:55:00Z', // 5 min ago < 7
    })
    expect(result).toEqual({ poll: false, reason: 'throttled' })
  })

  it('polls a live match once the throttle window has passed', () => {
    const result = shouldPoll({
      matches: [liveMatch],
      now,
      requestCountToday: 3,
      lastPolledAt: '2026-06-15T14:50:00Z', // 10 min ago > 7
    })
    expect(result).toEqual({ poll: true, reason: 'live-match' })
  })

  it('polls a live match when lastPolledAt is null', () => {
    const result = shouldPoll({
      matches: [liveMatch],
      now,
      requestCountToday: 3,
      lastPolledAt: null,
    })
    expect(result).toEqual({ poll: true, reason: 'live-match' })
  })

  it('treats a scheduled match inside its live window as qualifying', () => {
    const scheduled = makeMatch({ kickoff: '2026-06-15T14:00:00Z', state: 'scheduled' })
    const result = shouldPoll({
      matches: [scheduled],
      now,
      requestCountToday: 3,
      lastPolledAt: null,
    })
    expect(result).toEqual({ poll: true, reason: 'live-match' })
  })

  it('treats exactly minInterval elapsed as not throttled', () => {
    const result = shouldPoll({
      matches: [liveMatch],
      now,
      requestCountToday: 3,
      lastPolledAt: '2026-06-15T14:53:00Z', // exactly 7 min ago
    })
    expect(result).toEqual({ poll: true, reason: 'live-match' })
  })

  it('honors a custom minIntervalMinutes', () => {
    const result = shouldPoll({
      matches: [liveMatch],
      now,
      requestCountToday: 3,
      lastPolledAt: '2026-06-15T14:50:00Z', // 10 min ago
      minIntervalMinutes: 20,
    })
    expect(result).toEqual({ poll: false, reason: 'throttled' })
  })

  it('keeps polling a match we still believe is live even past its time window', () => {
    // A delayed match runs long: now is 3h after kickoff (past the 150min
    // window) but the API last told us it is still live. We must keep polling
    // so we eventually catch its finish, instead of freezing the score.
    const delayed = makeMatch({ kickoff: '2026-06-15T14:00:00Z', state: 'live' })
    const result = shouldPoll({
      matches: [delayed],
      now: new Date('2026-06-15T17:00:00Z'),
      requestCountToday: 3,
      lastPolledAt: '2026-06-15T16:50:00Z',
    })
    expect(result).toEqual({ poll: true, reason: 'live-match' })
  })
})

describe('liveTargetDates', () => {
  const today = '2026-06-22'

  it('falls back to today when nothing is live (daily-discovery run)', () => {
    const future = makeMatch({ kickoff: '2026-06-25T18:00:00Z', state: 'scheduled' })
    expect(liveTargetDates([future], new Date('2026-06-22T12:00:00Z'), today)).toEqual([today])
  })

  it('returns the single UTC date of one live match', () => {
    const live = makeMatch({ kickoff: '2026-06-22T18:00:00Z', state: 'live' })
    expect(liveTargetDates([live], new Date('2026-06-22T18:30:00Z'), today)).toEqual(['2026-06-22'])
  })

  it('returns ONE date for two concurrent matches on the same UTC day', () => {
    const a = makeMatch({ id: 'a', kickoff: '2026-06-22T18:00:00Z', state: 'live' })
    const b = makeMatch({ id: 'b', kickoff: '2026-06-22T18:00:00Z', state: 'live' })
    expect(liveTargetDates([a, b], new Date('2026-06-22T18:30:00Z'), today)).toEqual(['2026-06-22'])
  })

  it('returns BOTH dates for concurrent matches straddling UTC midnight', () => {
    // The real bug: France 21:00Z (22nd) live alongside Norway 00:00Z (23rd).
    const france = makeMatch({ id: 'fra', kickoff: '2026-06-22T21:00:00Z', state: 'live' })
    const norway = makeMatch({ id: 'nor', kickoff: '2026-06-23T00:00:00Z', state: 'live' })
    const now = new Date('2026-06-23T00:24:00Z')
    expect(liveTargetDates([france, norway], now, '2026-06-23')).toEqual([
      '2026-06-22',
      '2026-06-23',
    ])
  })

  it("includes a delayed match's date even when it is past its time window", () => {
    // France is past kickoff+150min but still flagged live; its date must still
    // be fetched so the stale score gets refreshed.
    const france = makeMatch({ id: 'fra', kickoff: '2026-06-22T21:00:00Z', state: 'live' })
    const now = new Date('2026-06-23T00:24:00Z') // 3h24m after kickoff, past window
    expect(liveTargetDates([france], now, '2026-06-23')).toEqual(['2026-06-22'])
  })

  it('excludes finished matches', () => {
    const done = makeMatch({ kickoff: '2026-06-22T18:00:00Z', state: 'finished' })
    expect(liveTargetDates([done], new Date('2026-06-22T18:30:00Z'), today)).toEqual([today])
  })
})
