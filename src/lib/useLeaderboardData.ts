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
}

const LIVE_REFRESH_MS = 30_000

export function useLeaderboardData() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })

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
      setState({ data: null, loading: false, error: firstError.message })
      return
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

  return { ...state, refresh: () => load(true) }
}
