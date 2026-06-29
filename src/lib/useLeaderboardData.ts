import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { MatchRow, PickRow, TeamRow, UserRow } from './types'

export type LeaderboardData = {
  users: UserRow[]
  teams: TeamRow[]
  matches: MatchRow[]
  picks: PickRow[]
}

type State = {
  data: LeaderboardData | null
  loading: boolean
  error: string | null
  // Who has locked a pick for each not-yet-started match (no team revealed).
  // Keyed by match id -> set of user ids. Lets the UI show "3 of 4 locked in"
  // without leaking the actual picks once confidentiality RLS is live.
  lockedByMatch: Record<string, string[]>
}

const LIVE_REFRESH_MS = 30_000

export function useLeaderboardData() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, lockedByMatch: {} })

  const load = useCallback(async (background = false) => {
    if (!background) setState((s) => ({ ...s, loading: true, error: null }))
    const [users, teams, matches, picks] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('picks').select('*'),
    ])
    const firstError = users.error ?? teams.error ?? matches.error ?? picks.error
    if (firstError) {
      setState({ data: null, loading: false, error: firstError.message, lockedByMatch: {} })
      return
    }

    // Lock status for scheduled matches (who voted, not what). Tolerant: the RPC
    // only exists once the confidentiality migration is applied — before then we
    // derive locks from the picks we can already read (RLS is still open).
    const lockedByMatch: Record<string, string[]> = {}
    const status = await supabase.rpc('scheduled_pick_status')
    const lockRows = (status.error ? null : status.data) as { match_id: string; user_id: string }[] | null
    if (lockRows) {
      for (const r of lockRows) (lockedByMatch[r.match_id] ??= []).push(r.user_id)
    } else {
      const scheduled = new Set((matches.data ?? []).filter((m: MatchRow) => m.state === 'scheduled').map((m) => m.id))
      for (const p of (picks.data ?? []) as PickRow[]) {
        if (scheduled.has(p.match_id)) (lockedByMatch[p.match_id] ??= []).push(p.user_id)
      }
    }

    setState({
      data: {
        users: (users.data ?? []) as UserRow[],
        teams: (teams.data ?? []) as TeamRow[],
        matches: (matches.data ?? []) as MatchRow[],
        picks: (picks.data ?? []) as PickRow[],
      },
      loading: false,
      error: null,
      lockedByMatch,
    })
  }, [])

  // Optimistically set a pick in local state so the UI reacts instantly,
  // before (or instead of) a network round-trip. Replaces any existing pick
  // for the same (match, user).
  const applyPick = useCallback((matchId: string, userId: string, pickedTeamId: string) => {
    setState((s) => {
      if (!s.data) return s
      const picks = s.data.picks.filter((p) => !(p.match_id === matchId && p.user_id === userId))
      picks.push({ match_id: matchId, user_id: userId, picked_team_id: pickedTeamId })
      const locked = s.lockedByMatch[matchId] ?? []
      const lockedByMatch = locked.includes(userId)
        ? s.lockedByMatch
        : { ...s.lockedByMatch, [matchId]: [...locked, userId] }
      return { ...s, data: { ...s.data, picks }, lockedByMatch }
    })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // While a match is live, quietly refresh so the score updates itself.
  const hasLive = state.data?.matches.some((m) => m.state === 'live') ?? false
  useEffect(() => {
    if (!hasLive) return
    const id = setInterval(() => load(true), LIVE_REFRESH_MS)
    return () => clearInterval(id)
  }, [hasLive, load])

  return { ...state, refresh: () => load(true), applyPick }
}
