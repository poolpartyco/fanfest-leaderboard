import './App.css'
import { useMemo } from 'react'
import { useLeaderboardData } from './lib/useLeaderboardData'
import { buildLeaderboard, getMatchWinner, pointsPerCorrectPick } from './lib/scoring'
import { partitionMatches, formatKickoffBogota, buildPicksByMatch, groupPicks } from './lib/view'
import { PickEntry } from './components/PickEntry'
import type { MatchRow, TeamRow } from './lib/types'

function App() {
  const { data, loading, error, refresh } = useLeaderboardData()

  const view = useMemo(() => {
    if (!data) return null
    const teamLookup = new Map<string, TeamRow>(data.teams.map((t) => [t.id, t]))
    const teamLabel = (id: string) => (id === 'draw' ? 'Draw' : teamLookup.get(id)?.name ?? id)
    const teamFlag = (id: string) => (id === 'draw' ? '🤝' : teamLookup.get(id)?.flag ?? '🏳️')
    const { live, past, upcoming } = partitionMatches(data.matches)
    const picksByMatch = buildPicksByMatch(data.picks)
    const leaderboard = buildLeaderboard(data.users, data.matches, data.picks)
    return { teamLabel, teamFlag, live, past, upcoming, picksByMatch, leaderboard }
  }, [data])

  if (loading) {
    return (
      <main className="app-shell">
        <div className="state-card">
          <span className="state-spinner" aria-hidden="true" />
          <p>Loading the leaderboard…</p>
        </div>
      </main>
    )
  }

  if (error || !data || !view) {
    return (
      <main className="app-shell">
        <div className="state-card state-card--error">
          <p className="state-title">Couldn’t load data</p>
          <p className="state-detail">{error ?? 'Unknown error'}</p>
        </div>
      </main>
    )
  }

  const { teamLabel, teamFlag, live, past, upcoming, picksByMatch, leaderboard } = view
  const leader = leaderboard[0]
  const topScore = leader?.points ?? 0
  const playedCount = past.length + live.length

  const renderPickGroups = (match: MatchRow, withVerdict: boolean) => {
    const winner = getMatchWinner(match)
    return groupPicks(picksByMatch[match.id], data.users).map((group) => {
      const isCorrect = withVerdict && winner !== null && group.teamId === winner
      const isWrong = withVerdict && winner !== null && group.teamId !== winner
      return (
        <div key={group.teamId} className="pick-group">
          <div className="pick-group-header">
            <span className="pick-group-choice">
              <span className="flag-icon" aria-hidden="true">{teamFlag(group.teamId)}</span>
              <strong>{teamLabel(group.teamId)}</strong>
            </span>
            {withVerdict && winner !== null && (
              <strong className={isCorrect ? 'pick-correct' : 'pick-wrong'}>
                {isCorrect ? 'Correct' : isWrong ? 'Wrong' : ''}
              </strong>
            )}
          </div>
          <p className="pick-group-users">{group.userNames.join(', ')}</p>
        </div>
      )
    })
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">World Cup pool · 2026</p>
          <h1>FanFest — PoolParty</h1>
          <p className="hero-description">
            Live scores straight from the pitch. Each correct match winner earns {pointsPerCorrectPick} points.
          </p>
        </div>

        <div className="hero-stats" aria-label="Leaderboard summary">
          <article>
            <span>Matches</span>
            <strong>{playedCount}</strong>
          </article>
          <article>
            <span>Leader</span>
            <strong>{leader?.user.name ?? 'N/A'}</strong>
          </article>
          <article>
            <span>Top score</span>
            <strong>{topScore} pts</strong>
          </article>
        </div>
      </section>

      {live.map((match) => {
        const when = formatKickoffBogota(match.kickoff)
        return (
          <section key={match.id} className="live-section">
            <div className="panel live-panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">
                    <span className="live-dot" aria-hidden="true" /> Live now
                  </p>
                  <h2>Happening on the pitch</h2>
                </div>
                <p className="panel-note">{when.day} · {when.time}</p>
              </div>

              <div className="live-scoreboard">
                <div className="live-team">
                  <span className="flag-icon flag-xl" aria-hidden="true">{teamFlag(match.home_team_id)}</span>
                  <strong>{teamLabel(match.home_team_id)}</strong>
                </div>
                <div className="live-score">
                  <span>{match.home_score ?? 0}</span>
                  <span className="live-score-sep">:</span>
                  <span>{match.away_score ?? 0}</span>
                </div>
                <div className="live-team live-team--right">
                  <span className="flag-icon flag-xl" aria-hidden="true">{teamFlag(match.away_team_id)}</span>
                  <strong>{teamLabel(match.away_team_id)}</strong>
                </div>
              </div>

              <div className="match-picks">{renderPickGroups(match, false)}</div>
            </div>
          </section>
        )
      })}

      <section className="content-grid">
        <div className="content-col">
          <article className="panel leaderboard-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Ranking</p>
                <h2>Leaderboard</h2>
              </div>
              <p className="panel-note">{pointsPerCorrectPick} pts per correct winner</p>
            </div>

            <ol className="leaderboard-list">
              {leaderboard.map((row, index) => (
                <li key={row.user.id} className={`leaderboard-row${index === 0 ? ' leaderboard-row--leader' : ''}`}>
                  <div className="rank-badge">{index + 1}</div>
                  <div className="leaderboard-nameblock">
                    <strong>{row.user.name}</strong>
                    <span>{row.correctPicks} of {row.totalMatches} correct</span>
                  </div>
                  <div className="leaderboard-points">{row.points} pts</div>
                </li>
              ))}
            </ol>
          </article>

          <PickEntry
            users={data.users}
            upcoming={upcoming}
            teamLabel={teamLabel}
            teamFlag={teamFlag}
            picksByMatch={picksByMatch}
            onSubmitted={refresh}
          />
        </div>

        <article className="panel matches-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Results</p>
              <h2>Matches</h2>
            </div>
            <p className="panel-note">Winner vs each pick</p>
          </div>

          <div className="matches-list">
            {past.length === 0 && <p className="pick-hint">No finished matches yet.</p>}
            {past.map((match) => (
              <article key={match.id} className="match-card">
                <div className="match-topline">
                  <span>{formatKickoffBogota(match.kickoff).day} · {formatKickoffBogota(match.kickoff).time}</span>
                  <span className="winner-pill">
                    {getMatchWinner(match) === 'draw' ? 'Draw' : `Winner: ${teamLabel(getMatchWinner(match) ?? '')}`}
                  </span>
                </div>

                <div className="match-teams">
                  <div className="team-block">
                    <span className="flag-icon" aria-hidden="true">{teamFlag(match.home_team_id)}</span>
                    <strong>{teamLabel(match.home_team_id)}</strong>
                  </div>
                  <div className="scoreline">
                    <span>{match.home_score}</span>
                    <span>—</span>
                    <span>{match.away_score}</span>
                  </div>
                  <div className="team-block team-block-right">
                    <strong>{teamLabel(match.away_team_id)}</strong>
                    <span className="flag-icon" aria-hidden="true">{teamFlag(match.away_team_id)}</span>
                  </div>
                </div>

                <div className="match-picks">{renderPickGroups(match, true)}</div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
