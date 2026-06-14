import './App.css'
import leaderboardData from './data/leaderboard.json'

type User = {
  id: string
  name: string
}

type Match = {
  id: string
  date: string
  hour: string
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  picks: Record<string, string>
}

type Team = {
  id: string
  name: string
  flag: string
}

type LeaderboardData = {
  users: User[]
  teams: Team[]
  matches: Match[]
}

type LeaderboardRow = {
  user: User
  points: number
  correctPicks: number
  totalMatches: number
}

type PickGroup = {
  pickId: string
  users: string[]
}

const pointsPerCorrectPick = 3
const data = leaderboardData as unknown as LeaderboardData

const teamLookup = new Map(data.teams.map((team) => [team.id, team]))

const currentYear = new Date().getFullYear()

const parseMatchDate = (date: string, hour: string) => {
  const [day, month] = date.split('/').map(Number)
  const [hours, minutes] = hour.split(':').map(Number)

  return new Date(currentYear, month - 1, day, hours, minutes)
}

const MATCH_DURATION_MS = 2 * 60 * 60 * 1000

const getMatchStatus = (match: Match) => {
  const start = parseMatchDate(match.date, match.hour).getTime()
  const end = start + MATCH_DURATION_MS
  const now = Date.now()

  if (now >= end) return 'past'
  if (now >= start && now < end) return 'live'

  return 'future'
}

const getPastMatches = (matches: Match[]) =>
  [...matches]
    .filter((m) => getMatchStatus(m) === 'past')
    .sort((a, b) => parseMatchDate(b.date, b.hour).getTime() - parseMatchDate(a.date, a.hour).getTime())

const getLiveMatch = (matches: Match[]) => matches.find((m) => getMatchStatus(m) === 'live')

// generic future matches helper removed in favor of limited next-day helper

const getEndOfTomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(23, 59, 59, 999)

  return d.getTime()
}

const getFutureMatchesUpToTomorrow = (matches: Match[]) => {
  const end = getEndOfTomorrow()

  return [...matches]
    .filter((m) => getMatchStatus(m) === 'future' && parseMatchDate(m.date, m.hour).getTime() <= end)
    .sort((a, b) => parseMatchDate(a.date, a.hour).getTime() - parseMatchDate(b.date, b.hour).getTime())
}

const formatDateKey = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

const groupMatchesByDay = (matches: Match[]) => {
  const map = new Map<string, Match[]>()

  matches.forEach((m) => {
    const key = formatDateKey(parseMatchDate(m.date, m.hour))
    const list = map.get(key) ?? []
    list.push(m)
    map.set(key, list)
  })

  return Array.from(map.entries()).map(([date, list]) => ({ date, matches: list.sort((a, b) => parseMatchDate(a.date, a.hour).getTime() - parseMatchDate(b.date, b.hour).getTime()) }))
}

// Current time is used directly when computing match status

const getMatchWinner = (match: Match) => {
  if (match.homeScore > match.awayScore) {
    return match.homeTeamId
  }

  if (match.awayScore > match.homeScore) {
    return match.awayTeamId
  }

  return 'draw'
}

const getTeam = (teamId: string) => teamLookup.get(teamId)

const getTeamLabel = (teamId: string) => getTeam(teamId)?.name ?? teamId

const getTeamFlag = (teamId: string) => getTeam(teamId)?.flag ?? '🏳️'

const groupMatchPicks = (match: Match, users: User[]) => {
  const groups = new Map<string, string[]>()

  users.forEach((user) => {
    const pickId = match.picks[user.id]
    const userNames = groups.get(pickId) ?? []
    userNames.push(user.name)
    groups.set(pickId, userNames)
  })

  return Array.from(groups.entries()).map<PickGroup>(([pickId, groupedUsers]) => ({
    pickId,
    users: groupedUsers,
  }))
}

const buildLeaderboard = ({ users }: LeaderboardData, pastMatches: Match[]) =>
  users
    .map<LeaderboardRow>((user) => {
      const correctPicks = pastMatches.reduce((total, match) => {
        return match.picks[user.id] === getMatchWinner(match) ? total + 1 : total
      }, 0)

      return {
        user,
        points: correctPicks * pointsPerCorrectPick,
        correctPicks,
        totalMatches: pastMatches.length,
      }
    })
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points
      }

      return right.correctPicks - left.correctPicks
    })

// visible/past/live/future match lists are computed via helpers above

function App() {
  const liveMatch = getLiveMatch(data.matches)
  const pastMatches = getPastMatches(data.matches)
  const futureMatches = getFutureMatchesUpToTomorrow(data.matches)
  const upcomingByDay = groupMatchesByDay(futureMatches)
  const leaderboard = buildLeaderboard(data, pastMatches)
  const leader = leaderboard[0]
  const topScore = leader?.points ?? 0
  const matchCount = pastMatches.length + (liveMatch ? 1 : 0)

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Soccer leaderboard</p>
          <h1>FanFest - PoolParty</h1>
          <p className="hero-description">
            Each correct pick earns {pointsPerCorrectPick} points.
          </p>
        </div>

        <div className="hero-stats" aria-label="Leaderboard summary">
          <article>
            <span>Matches</span>
            <strong>{matchCount}</strong>
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

      {liveMatch && (
        <section className="live-section">
          <div className="panel live-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Live</p>
                <h2>Live match</h2>
              </div>
              <p className="panel-note">Happening now</p>
            </div>

            <article className="match-card match-live">
              <div className="match-topline">
                <span>
                  {liveMatch.date} • {liveMatch.hour} (Live)
                </span>
                <span className="winner-pill">Live match</span>
              </div>

              <div className="match-teams">
                <div className="team-block">
                  <span className="flag-icon" aria-hidden="true">
                    {getTeamFlag(liveMatch.homeTeamId)}
                  </span>
                  <strong>{getTeamLabel(liveMatch.homeTeamId)}</strong>
                </div>
                <div className="team-block team-block-right">
                  <strong>{getTeamLabel(liveMatch.awayTeamId)}</strong>
                  <span className="flag-icon" aria-hidden="true">
                    {getTeamFlag(liveMatch.awayTeamId)}
                  </span>
                </div>
              </div>

              <div className="match-picks">
                {groupMatchPicks(liveMatch, data.users).map((group) => {
                  const choiceLabel = getTeamLabel(group.pickId)
                  const pickFlag = getTeamFlag(group.pickId)

                  return (
                    <div key={group.pickId} className="pick-group">
                      <div className="pick-group-header">
                        <span className="pick-group-choice">
                          <span className="flag-icon" aria-hidden="true">
                            {pickFlag}
                          </span>
                          <strong>{choiceLabel}</strong>
                        </span>
                      </div>
                      <p className="pick-group-users">{group.users.join(', ')}</p>
                    </div>
                  )
                })}
              </div>
            </article>
          </div>
        </section>
      )}

      <section className="content-grid">
        <article className="panel leaderboard-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Ranking</p>
              <h2>Leaderboard</h2>
            </div>
            <p className="panel-note">3 points per correct match winner</p>
          </div>

          <ol className="leaderboard-list">
            {leaderboard.map((row, index) => (
              <li key={row.user.id} className="leaderboard-row">
                <div className="rank-badge">{index + 1}</div>
                <div className="leaderboard-nameblock">
                  <strong>{row.user.name}</strong>
                  <span>
                    {row.correctPicks} of {row.totalMatches} correct
                  </span>
                </div>
                <div className="leaderboard-points">{row.points} pts</div>
              </li>
            ))}
          </ol>

          <div className="upcoming-matches">
            <p className="panel-kicker">Upcoming</p>
            {upcomingByDay.map((group) => (
              <div key={group.date} className="upcoming-day">
                <h4 className="upcoming-day-title">{group.date}</h4>
                <ul className="upcoming-list">
                  {group.matches.map((m) => (
                    <li key={m.id} className="upcoming-item">
                      <span className="upcoming-hour">{m.hour}</span>
                      <span className="flag-icon">{getTeamFlag(m.homeTeamId)}</span>
                      <span className="upcoming-team">{getTeamLabel(m.homeTeamId)}</span>
                      <span className="vs">vs</span>
                      <span className="flag-icon">{getTeamFlag(m.awayTeamId)}</span>
                      <span className="upcoming-team">{getTeamLabel(m.awayTeamId)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>

        <article className="panel matches-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Source data</p>
              <h2>Matches</h2>
            </div>
            <p className="panel-note">Winner compared against each user selection</p>
          </div>

          <div className="matches-list">
            {pastMatches.map((match) => (
              <article key={match.id} className="match-card">
                <div className="match-topline">
                  <span>
                    {match.date} • {match.hour}
                  </span>
                  <span className="winner-pill">
                    Winner: {getTeamLabel(getMatchWinner(match))}
                  </span>
                </div>

                <div className="match-teams">
                  <div className="team-block">
                    <span className="flag-icon" aria-hidden="true">
                      {getTeamFlag(match.homeTeamId)}
                    </span>
                    <strong>{getTeamLabel(match.homeTeamId)}</strong>
                  </div>
                  <div className="scoreline">
                    <span>{match.homeScore}</span>
                    <span>—</span>
                    <span>{match.awayScore}</span>
                  </div>
                  <div className="team-block team-block-right">
                    <strong>{getTeamLabel(match.awayTeamId)}</strong>
                    <span className="flag-icon" aria-hidden="true">
                      {getTeamFlag(match.awayTeamId)}
                    </span>
                  </div>
                </div>

                <div className="match-picks">
                  {groupMatchPicks(match, data.users).map((group) => {
                    const isCorrect = group.pickId === getMatchWinner(match)
                    const choiceLabel = getTeamLabel(group.pickId)
                    const pickFlag = getTeamFlag(group.pickId)

                    return (
                      <div key={group.pickId} className="pick-group">
                        <div className="pick-group-header">
                          <span className="pick-group-choice">
                            <span className="flag-icon" aria-hidden="true">
                              {pickFlag}
                            </span>
                            <strong>{choiceLabel}</strong>
                          </span>
                          <strong className={isCorrect ? 'pick-correct' : 'pick-wrong'}>
                            {isCorrect ? 'Correct' : 'Wrong'}
                          </strong>
                        </div>
                        <p className="pick-group-users">{group.users.join(', ')}</p>
                      </div>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
