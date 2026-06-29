import './App.css'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useLeaderboardData } from './lib/useLeaderboardData'
import { buildLeaderboard } from './lib/scoring'
import { partitionMatches, formatKickoffBogota, buildPicksByMatch, voteDayMatches } from './lib/view'
import { winnerSide, pickSide, pickResult, sideToTeamId, liveClockLabel, type Side } from './lib/designView'
import { THEMES, playerColor } from './lib/themes'
import { submitPick } from './lib/picks'
import { avatarFor } from './lib/avatars'
import { Flag } from './components/Flag'
import { LiveStands } from './components/LiveStands'
import { NextUpPoll } from './components/NextUpPoll'
import { VoteCountdown } from './components/VoteCountdown'
import { KnockoutBracket } from './components/KnockoutBracket'
import { RoadToGlory } from './components/RoadToGlory'
import { hasBothTeams } from './lib/bracketView'
import { useAuth } from './lib/auth'
import { Login } from './components/Login'
import type { MatchRow, TeamRow, UserRow } from './lib/types'

type Tab = 'leaderboard' | 'vote' | 'matches' | 'upcoming' | 'bracket'
const TABS: Tab[] = ['leaderboard', 'vote', 'matches', 'upcoming', 'bracket']

const OPT_COLOR: Record<Side, string> = { home: 'var(--accent)', draw: '#9aa7ba', away: 'var(--gold)' }

function rankRing(rank: number) {
  if (rank === 1) return { ring: 'linear-gradient(135deg,#f8dd86,#c8932f)', num: '#3a2a06', glow: '0 0 24px rgba(245,196,81,.35)' }
  if (rank === 2) return { ring: 'linear-gradient(135deg,#e3ebf4,#9aa7ba)', num: '#2a3140', glow: 'none' }
  if (rank === 3) return { ring: 'linear-gradient(135deg,#ecb483,#b56f37)', num: '#3a2207', glow: 'none' }
  return { ring: 'linear-gradient(135deg,var(--accent),#3a6fd0)', num: '#06101f', glow: 'none' }
}

function pickChipStyle(res: 'correct' | 'wrong' | 'none', dim: boolean): CSSProperties {
  let background = 'transparent', borderColor = 'var(--line)', color = 'var(--muted)', dashed = false
  if (res === 'correct') { background = 'rgba(94,224,160,.12)'; borderColor = 'rgba(94,224,160,.5)'; color = 'var(--good)' }
  else if (res === 'wrong') { background = 'rgba(255,122,138,.1)'; borderColor = 'rgba(255,122,138,.45)'; color = 'var(--bad)' }
  else { color = 'var(--faint)'; dashed = true }
  return { background, border: `1px solid ${borderColor}`, borderStyle: dashed ? 'dashed' : 'solid', color, opacity: dim ? 0.35 : 1 }
}

const ROOT_BG =
  'radial-gradient(150% 95% at 50% -18%, var(--glow), transparent 52%),' +
  'repeating-linear-gradient(90deg, rgba(255,255,255,.013) 0 66px, rgba(0,0,0,0) 66px 132px),' +
  'var(--bg0)'

// Signed into Google, but the email isn't linked to any of the four players.
function NotInPool({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  return (
    <div className="ff-root" style={{ ...(THEMES.fiesta as CSSProperties), background: ROOT_BG }}>
      <div className="ff-state">
        <p className="ff-state-title">You're not in this pool</p>
        <p>{email ? <><strong>{email}</strong> isn't linked to a player.</> : 'This account isn\'t linked to a player.'} Ask the organizer to add you, then sign in again.</p>
        <button className="ff-segbtn" style={{ marginTop: 14, borderColor: 'var(--line)' }} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  )
}

function App() {
  const { session, loading: authLoading, email: authEmail, signOut } = useAuth()
  const { data, loading, error, refresh, applyPick, lockedByMatch } = useLeaderboardData()
  const hash = typeof window !== 'undefined' ? window.location.hash.slice(1).split('/') : []
  const initialTab = TABS.find((t) => t === hash[0]) ?? 'leaderboard'
  const [tab, setTab] = useState<Tab>(initialTab)
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent')
  const [filterPlayer, setFilterPlayer] = useState<string>('Everyone')
  const [filterResult, setFilterResult] = useState<'all' | 'correct' | 'wrong'>('all')
  const [shown, setShown] = useState<Record<string, number>>({})
  const [, setNowTick] = useState(0)
  const rafRef = useRef<number>(0)

  // Tick for the live minute (every 30s, in step with data refresh).
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const vm = useMemo(() => {
    if (!data) return null
    const teamLookup = new Map<string, TeamRow>(data.teams.map((t) => [t.id, t]))
    const teamLabel = (id: string | null) => (id === 'draw' ? 'Draw' : id == null ? 'TBD' : teamLookup.get(id)?.name ?? id)
    const teamEmoji = (id: string | null) => (id == null ? undefined : teamLookup.get(id)?.flag)
    const standings = buildLeaderboard(data.users, data.matches, data.picks)
    const { live, past, upcoming: allUpcoming } = partitionMatches(data.matches)
    // Hide unresolved knockout slots (no teams yet) from Vote/Upcoming/next-up.
    const upcoming = allUpcoming.filter(hasBothTeams)
    const knockout = data.matches.filter((m) => m.stage === 'knockout')
    const picksByMatch = buildPicksByMatch(data.picks)
    return { teamLabel, teamEmoji, standings, live, past, upcoming, knockout, picksByMatch, players: data.users }
  }, [data])

  const ready = !!vm
  // Count-up points on entering the leaderboard tab / first data load.
  useEffect(() => {
    if (!ready || tab !== 'leaderboard' || !vm) return
    const standings = vm.standings
    const start = performance.now()
    const dur = 1000
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur)
      const e = 1 - Math.pow(1 - k, 3)
      const next: Record<string, number> = {}
      standings.forEach((r) => { next[r.user.id] = Math.round(r.points * e) })
      setShown(next)
      if (k < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tab])

  // Auth gate runs before data: show the login until a Google session exists.
  if (authLoading) {
    return (
      <div className="ff-root" style={{ ...(THEMES.fiesta as CSSProperties), background: ROOT_BG }}>
        <div className="ff-state"><span className="ff-spinner" /><p>Checking your session…</p></div>
      </div>
    )
  }
  if (!session) {
    return <Login />
  }

  if (loading) {
    return (
      <div className="ff-root" style={{ ...(THEMES.fiesta as CSSProperties), background: ROOT_BG }}>
        <div className="ff-state"><span className="ff-spinner" /><p>Loading the leaderboard…</p></div>
      </div>
    )
  }
  if (error || !vm) {
    return (
      <div className="ff-root" style={{ ...(THEMES.fiesta as CSSProperties), background: ROOT_BG }}>
        <div className="ff-state"><p className="ff-state-title">Couldn’t load data</p><p>{error ?? 'Unknown error'}</p></div>
      </div>
    )
  }

  const { teamLabel, teamEmoji, standings, live, past, upcoming, knockout, picksByMatch, players } = vm

  // Map the Google session to one of the four players by email.
  const me = players.find((p) => p.email && authEmail && p.email.toLowerCase() === authEmail.toLowerCase()) ?? null
  if (!me) {
    return <NotInPool email={authEmail} onSignOut={signOut} />
  }

  const leader = standings[0]
  const hasLive = live.length > 0

  const dotStyle = (name: string, i: number): CSSProperties => ({ background: playerColor(name, i) })
  const avatarStyle = (name: string, i: number, neg: boolean): CSSProperties =>
    ({ background: playerColor(name, i), ...(neg ? { marginLeft: -7 } : {}) })

  // Jump to the Matches tab filtered to a player's correct picks.
  const showPlayerHits = (name: string) => {
    setFilterPlayer(name)
    setFilterResult('correct')
    setTab('matches')
  }

  // ----- Leaderboard -----
  const podiumOrder = [standings[1], standings[0], standings[2]].filter(Boolean)
  const renderPodium = () =>
    podiumOrder.map((s) => {
      const rc = rankRing(s.user === leader.user ? 1 : standings.indexOf(s) + 1)
      const rank = standings.indexOf(s) + 1
      const av = rank === 1 ? 64 : 52
      const barH = rank === 1 ? 108 : rank === 2 ? 78 : 60
      return (
        <div key={s.user.id} className="ff-podium-col" style={{ animation: `ffrise .6s ${(3 - rank) * 0.08}s both` }}>
          <div className="ff-podium-av" style={{ width: av, height: av, background: rc.ring, color: rc.num, boxShadow: rc.glow, fontSize: rank === 1 ? 26 : 21 }}>{rank}</div>
          <div className="ff-podium-name">{s.user.name}</div>
          <div className="ff-podium-pts">{s.points} pts</div>
          <div className="ff-podium-bar" style={{ height: barH }} />
        </div>
      )
    })

  const renderRanking = () =>
    standings.map((r, i) => {
      const rank = i + 1
      const rc = rankRing(rank)
      const pct = r.totalMatches ? Math.round((r.correctPicks / r.totalMatches) * 100) : 0
      return (
        <div
          key={r.user.id}
          className={`ff-rankrow ff-rankrow--tap${rank === 1 ? ' is-leader' : ''}`}
          style={{ animation: `fffade .5s ${i * 0.07}s both` }}
          role="button"
          tabIndex={0}
          title={`See ${r.user.name}'s correct picks`}
          onClick={() => showPlayerHits(r.user.name)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPlayerHits(r.user.name) } }}
        >
          <div className="ff-badge" style={{ background: rc.ring, color: rc.num, boxShadow: rc.glow }}>{rank}</div>
          <div className="ff-rankrow-main">
            <div className="ff-rankrow-name">{r.user.name}</div>
            <div className="ff-rankrow-sub">{r.correctPicks} of {r.totalMatches} correct</div>
            <div className="ff-track"><div className="ff-track-fill" style={{ width: `${pct}%` }} /></div>
          </div>
          <div className="ff-rankrow-r">
            <div className="ff-rankrow-pts">{shown[r.user.id] ?? r.points}</div>
            <div className="ff-rankrow-ptsl">pts</div>
          </div>
          <span className="ff-rankrow-go" aria-hidden="true">›</span>
        </div>
      )
    })

  // ----- Matches -----
  const sortedPast = [...past].sort((a, b) => {
    const t = new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
    return sort === 'recent' ? -t : t
  })
  const presult = (m: MatchRow, u: UserRow) => pickResult(pickSide(m, picksByMatch[m.id]?.[u.id]), winnerSide(m))
  const filteredMatches = (filterPlayer !== 'Everyone' && filterResult !== 'all')
    ? sortedPast.filter((m) => {
        const r = presult(m, players.find((p) => p.name === filterPlayer)!)
        return filterResult === 'correct' ? r === 'correct' : r !== 'correct'
      })
    : sortedPast
  const winnerLabel = (m: MatchRow) => {
    const w = winnerSide(m)
    if (w === 'draw') return 'Draw'
    if (w === 'home') return teamLabel(m.home_team_id)
    if (w === 'away') return teamLabel(m.away_team_id)
    return ''
  }
  const selectedPlayer = players.find((p) => p.name === filterPlayer)
  const selectedCorrect = selectedPlayer ? past.filter((m) => presult(m, selectedPlayer) === 'correct').length : 0
  const filterNote = filterPlayer === 'Everyone'
    ? 'Pick a friend to see their correct picks'
    : `${filterPlayer}: ${selectedCorrect} correct of ${past.length}`

  // ----- Vote / Upcoming -----
  const longDay = (iso: string) => {
    const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', weekday: 'long' }).format(new Date(iso))
    return `${wd} ${formatKickoffBogota(iso).day}`
  }
  // Vote tab only shows the current day's fixtures (falls back to the soonest
  // upcoming matchday so it's never empty).
  const voteMatches = voteDayMatches(upcoming, new Date())
  // Counts/locks come from lock-status (who voted, not what) so they stay correct
  // once others' scheduled picks are hidden by RLS.
  const votedCount = (m: MatchRow) => lockedByMatch[m.id]?.length ?? 0
  const hasLocked = (m: MatchRow, u: UserRow) => (lockedByMatch[m.id] ?? []).includes(u.id)

  // You can only cast your OWN pick. Optimistic, then persist; RLS enforces the
  // identity + before-kickoff window server-side.
  const castVote = (m: MatchRow, side: Side) => {
    const teamId = sideToTeamId(m, side)
    if (teamId === null) return // unresolved slot has no team to back yet
    applyPick(m.id, me.id, teamId)
    void submitPick(m.id, me.id, teamId).then(({ error }) => {
      if (error) refresh()
    })
  }

  const upcomingGroups = (() => {
    const groups = new Map<string, MatchRow[]>()
    for (const m of upcoming) {
      const key = longDay(m.kickoff)
      ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(m)
    }
    return Array.from(groups.entries()).map(([date, fixtures]) => ({ date, fixtures }))
  })()

  const seg = (active: boolean, sm = false) => `ff-segbtn${sm ? ' ff-segbtn--sm' : ''}${active ? ' is-active' : ''}`

  // Banner: a live match takes the slot; otherwise the last result + next poll.
  // ?preview=next forces the no-live view for previewing.
  const forceNext = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'next'
  const noLive = !hasLive || forceNext
  const ftMatch = noLive ? past[0] ?? null : null
  const ftCorrectNames = ftMatch ? players.filter((u) => presult(ftMatch, u) === 'correct').map((u) => u.name) : []
  const nextMatch = noLive ? upcoming[0] ?? null : null

  return (
    <div className="ff-root" style={{ ...(THEMES.fiesta as CSSProperties), background: ROOT_BG }}>
      <div className="ff-wrap">

        {/* Header */}
        <div className="ff-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div className="ff-brand">
            <div className="ff-brand-mark"><div className="ff-brand-dot" /></div>
            <span className="ff-brand-name">FanFest · PoolParty</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="ff-bc-ring" style={{ '--ring': playerColor(me.name, players.indexOf(me)) } as CSSProperties} title={me.name}>
              {avatarFor(me.name)
                ? <img className="ff-bc-av" src={avatarFor(me.name)} width={30} height={30} alt={me.name} />
                : <span className="ff-bc-av ff-bc-av--init" style={{ width: 30, height: 30, background: playerColor(me.name, players.indexOf(me)) }}>{me.name[0]}</span>}
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{me.name}</span>
            <button
              onClick={() => void signOut()}
              style={{ background: 'var(--panel2)', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 9999, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              title="Sign out"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="ff-hero">
          <div className="ff-hero-glow g1" /><div className="ff-hero-glow g2" />
          <div className="ff-hero-circle" /><div className="ff-hero-vline" /><div className="ff-hero-arc" />
          <div className="ff-hero-row">
            <div className="ff-hero-copy">
              <div className="ff-hero-kicker">Soccer Leaderboard</div>
              <h1 className="ff-hero-title">FanFest — PoolParty</h1>
              <div className="ff-hero-sub">Each correct pick earns <strong>3 points</strong>.</div>
            </div>
            <div className="ff-stats">
              <div className="ff-stat"><div className="ff-stat-l">Matches</div><div className="ff-stat-v">{past.length + live.length}</div></div>
              <div className="ff-stat"><div className="ff-stat-l">Leader</div><div className="ff-stat-v gold">{leader?.user.name ?? 'N/A'}</div></div>
              <div className="ff-stat"><div className="ff-stat-l">Top score</div><div className="ff-stat-v">{leader?.points ?? 0} <span className="unit">pts</span></div></div>
            </div>
          </div>
        </div>

        {/* Banner: every live match (concurrent fixtures each get a card),
            else last result + next-up poll. The live label is re-derived per
            match each render; the 30s tick above keeps them moving. */}
        {!noLive ? (
          live.map((m) => (
            <LiveStands
              key={m.id}
              match={m}
              players={players}
              picksByMatch={picksByMatch}
              teamLabel={teamLabel}
              teamEmoji={teamEmoji}
              liveLabel={liveClockLabel(m, Date.now())}
            />
          ))
        ) : (
          <>
            {ftMatch && (
              <div className="ff-ft">
                <span className="ff-ft-tag">Full time</span>
                <span className="ff-ft-score">
                  <Flag teamId={ftMatch.home_team_id} emoji={teamEmoji(ftMatch.home_team_id)} size={24} />
                  <b>{teamLabel(ftMatch.home_team_id)} {ftMatch.home_score} - {ftMatch.away_score} {teamLabel(ftMatch.away_team_id)}</b>
                  <Flag teamId={ftMatch.away_team_id} emoji={teamEmoji(ftMatch.away_team_id)} size={24} />
                </span>
                <span className="ff-ft-when">{ftCorrectNames.length ? `${ftCorrectNames.join(', ')} called it, +3 pts` : 'Nobody called it'}</span>
              </div>
            )}
            {nextMatch && (
              <NextUpPoll
                match={nextMatch}
                players={players}
                me={me}
                picksByMatch={picksByMatch}
                lockedUserIds={lockedByMatch[nextMatch.id] ?? []}
                teamLabel={teamLabel}
                teamEmoji={teamEmoji}
                onVote={() => setTab('vote')}
              />
            )}
          </>
        )}

        {/* Tabs */}
        <div className="ff-tabs">
          {TABS.map((t) => (
            <button key={t} className={seg(tab === t)} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {tab === 'leaderboard' && (
          <div>
            {knockout.length > 0 && (
              <RoadToGlory
                matches={knockout}
                players={players}
                picksByMatch={picksByMatch}
                teamLabel={teamLabel}
                teamEmoji={teamEmoji}
                onOpenFull={() => setTab('bracket')}
              />
            )}
            <div className="ff-podium">{renderPodium()}</div>
            <div className="ff-rankcard">
              <div className="ff-rankhead">
                <div className="ff-rankhead-l">Full ranking</div>
                <div className="ff-rankhead-r">3 points per correct winner</div>
              </div>
              {renderRanking()}
            </div>
          </div>
        )}

        {/* Vote — you cast only your own pick; everyone's picks stay sealed
            until kickoff so nobody can be influenced. */}
        {tab === 'vote' && (
          <div>
            <div className="ff-vote-intro">Lock your pick before kickoff. <strong>3 points</strong> for a correct call. Everyone's picks stay sealed until the match starts.</div>
            <div className="ff-vote-list">
              {voteMatches.length === 0 && <div className="ff-poll">No upcoming matches to vote on.</div>}
              {voteMatches.map((m) => {
                const total = votedCount(m)
                const done = total === players.length
                const myCurrent = pickSide(m, picksByMatch[m.id]?.[me.id])
                const keys: [Side, string][] = [['home', teamLabel(m.home_team_id)], ['draw', 'Draw'], ['away', teamLabel(m.away_team_id)]]
                const myLabel = (s: Side | null) => s === null ? '—' : s === 'draw' ? 'Draw' : teamLabel(s === 'home' ? m.home_team_id : m.away_team_id)
                return (
                  <div key={m.id} className="ff-poll">
                    <div className="ff-poll-head">
                      <span className="ff-poll-date">{formatKickoffBogota(m.kickoff).day} · {formatKickoffBogota(m.kickoff).time}</span>
                      <VoteCountdown kickoff={m.kickoff} />
                      <span className="ff-voted" style={{ background: done ? 'rgba(94,224,160,.14)' : 'var(--panel2)', border: `1px solid ${done ? 'rgba(94,224,160,.4)' : 'var(--line)'}`, color: done ? 'var(--good)' : 'var(--muted)' }}>{total}/{players.length} locked in</span>
                    </div>
                    <div className="ff-poll-teams">
                      <div className="ff-poll-team"><Flag teamId={m.home_team_id} emoji={teamEmoji(m.home_team_id)} size={26} /><span className="ff-poll-tname">{teamLabel(m.home_team_id)}</span></div>
                      <span className="ff-vs">vs</span>
                      <div className="ff-poll-team away"><span className="ff-poll-tname">{teamLabel(m.away_team_id)}</span><Flag teamId={m.away_team_id} emoji={teamEmoji(m.away_team_id)} size={26} /></div>
                    </div>

                    {/* Your own pick — the only one you can set */}
                    <div className="ff-voter" style={{ marginTop: 4 }}>
                      <div className="ff-voter-id">
                        <span className="ff-bc-ring" style={{ '--ring': playerColor(me.name, players.indexOf(me)) } as CSSProperties}>
                          {avatarFor(me.name)
                            ? <img className="ff-bc-av" src={avatarFor(me.name)} width={30} height={30} alt={me.name} />
                            : <span className="ff-bc-av ff-bc-av--init" style={{ width: 30, height: 30, background: playerColor(me.name, players.indexOf(me)) }}>{me.name[0]}</span>}
                        </span>
                        <span className="ff-voter-name">Your pick</span>
                      </div>
                      <div className="ff-voter-opts">
                        {keys.map(([side, label]) => {
                          const active = myCurrent === side
                          return (
                            <button key={side} className="ff-voteseg" style={active ? { borderColor: OPT_COLOR[side], background: OPT_COLOR[side], color: '#0a0f1c' } : undefined} onClick={() => castVote(m, side)}>{label}</button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Everyone else — locked or waiting, never their actual pick */}
                    <div className="ff-poll-voters" style={{ marginTop: 10 }}>
                      {players.filter((u) => u.id !== me.id).map((u, pi) => {
                        const locked = hasLocked(m, u)
                        return (
                          <div key={u.id} className="ff-voter">
                            <div className="ff-voter-id">
                              {avatarFor(u.name)
                                ? <span className="ff-bc-ring" style={{ '--ring': playerColor(u.name, pi + 1) } as CSSProperties}><img className="ff-bc-av" src={avatarFor(u.name)} width={30} height={30} alt={u.name} /></span>
                                : <span className="ff-av" style={avatarStyle(u.name, pi + 1, false)}>{u.name[0]}</span>}
                              <span className="ff-voter-name">{u.name}</span>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: locked ? 'var(--good)' : 'var(--faint)' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: locked ? 'var(--good)' : 'var(--faint)' }} />
                              {locked ? 'Locked in' : 'Waiting'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--faint)' }}>
                      You picked <strong style={{ color: 'var(--ink)' }}>{myLabel(myCurrent)}</strong>. Everyone's picks reveal at kickoff.
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Matches */}
        {tab === 'matches' && (
          <div>
            <div className="ff-filters">
              <select className="ff-select" value={filterPlayer} onChange={(e) => setFilterPlayer(e.target.value)}>
                <option value="Everyone">All players</option>
                {players.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
              <div className="ff-seg">
                {([['all', 'All'], ['correct', 'Correct'], ['wrong', 'Missed']] as const).map(([k, l]) => (
                  <button key={k} className={seg(filterResult === k, true)} onClick={() => setFilterResult(k)}>{l}</button>
                ))}
              </div>
              <button className="ff-segbtn ff-segbtn--sm" style={{ borderColor: 'var(--line)' }} onClick={() => setSort(sort === 'recent' ? 'oldest' : 'recent')}>
                {sort === 'recent' ? 'Newest first ↓' : 'Oldest first ↑'}
              </button>
              <span className="ff-filter-note">{filterNote}</span>
            </div>
            <div className="ff-matches">
              {filteredMatches.map((m) => {
                const w = winnerSide(m)
                return (
                  <div key={m.id} className="ff-match">
                    <div className="ff-match-top">
                      <span className="ff-match-date">{formatKickoffBogota(m.kickoff).day} · {formatKickoffBogota(m.kickoff).time}</span>
                      <span className="ff-winpill">Winner · {winnerLabel(m)}</span>
                    </div>
                    <div className="ff-match-row">
                      <div className="ff-match-team">
                        <Flag teamId={m.home_team_id} emoji={teamEmoji(m.home_team_id)} size={30} />
                        <span className="ff-match-name" style={{ fontWeight: w === 'home' ? 800 : 600, color: w === 'home' ? 'var(--ink)' : 'var(--muted)' }}>{teamLabel(m.home_team_id)}</span>
                      </div>
                      <div className="ff-scorebox">
                        <span className="ff-scorenum">{m.home_score}</span><span className="ff-live-dash">–</span><span className="ff-scorenum">{m.away_score}</span>
                      </div>
                      <div className="ff-match-team away">
                        <span className="ff-match-name" style={{ fontWeight: w === 'away' ? 800 : 600, color: w === 'away' ? 'var(--ink)' : 'var(--muted)', textAlign: 'right' }}>{teamLabel(m.away_team_id)}</span>
                        <Flag teamId={m.away_team_id} emoji={teamEmoji(m.away_team_id)} size={30} />
                      </div>
                    </div>
                    <div className="ff-match-picks">
                      {players.map((u, i) => {
                        const r = presult(m, u)
                        const ps = pickSide(m, picksByMatch[m.id]?.[u.id])
                        const lbl = ps === null ? 'No pick' : ps === 'draw' ? 'Draw' : teamLabel(ps === 'home' ? m.home_team_id : m.away_team_id)
                        return (
                          <span key={u.id} className="ff-pick" style={pickChipStyle(r, filterPlayer !== 'Everyone' && filterPlayer !== u.name)} title={`${u.name} picked ${lbl}`}>
                            <span className="ff-chip-dot" style={dotStyle(u.name, i)} />{u.name}
                            <span className="ff-pick-icon">{r === 'correct' ? '✓' : r === 'wrong' ? '✕' : '·'}</span>
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {tab === 'upcoming' && (
          <div className="ff-up">
            {upcomingGroups.map((g) => (
              <div key={g.date}>
                <div className="ff-up-date">{g.date}</div>
                <div className="ff-up-list">
                  {g.fixtures.map((m) => {
                    const total = votedCount(m)
                    const done = total === players.length
                    return (
                      <div key={m.id} className="ff-up-fix">
                        <span className="ff-up-time">{formatKickoffBogota(m.kickoff).time}</span>
                        <div className="ff-up-teams">
                          <Flag teamId={m.home_team_id} emoji={teamEmoji(m.home_team_id)} size={26} /><span className="ff-up-tname">{teamLabel(m.home_team_id)}</span>
                          <span className="ff-up-vs">vs</span>
                          <span className="ff-up-tname">{teamLabel(m.away_team_id)}</span><Flag teamId={m.away_team_id} emoji={teamEmoji(m.away_team_id)} size={26} />
                        </div>
                        <button className="ff-up-btn" style={{ background: done ? 'rgba(94,224,160,.14)' : 'var(--accentSoft)', border: `1px solid ${done ? 'rgba(94,224,160,.4)' : 'var(--line)'}`, color: done ? 'var(--good)' : 'var(--ink)' }} onClick={() => setTab('vote')}>
                          {total}/{players.length} voted · Open vote →
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {upcomingGroups.length === 0 && <div className="ff-up-fix">No upcoming fixtures.</div>}
          </div>
        )}

        {/* Bracket */}
        {tab === 'bracket' && (
          <div className="ff-kb">
            <div className="ff-kb-head-band">
              <div className="ff-kb-head-kicker">World Cup 2026 · Knockout stage</div>
              <h2 className="ff-kb-head-title">Knockout bracket</h2>
              <div className="ff-kb-legend">
                <span className="ff-kb-leg"><i style={{ background: 'var(--bad)' }} />Live now</span>
                <span className="ff-kb-leg"><i style={{ background: 'var(--accent)' }} />Winner advances</span>
                <span className="ff-kb-leg"><i style={{ background: 'var(--faint)' }} />Awaiting result</span>
              </div>
            </div>
            <KnockoutBracket matches={knockout} teamLabel={teamLabel} teamEmoji={teamEmoji} />
          </div>
        )}

      </div>
    </div>
  )
}

export default App
