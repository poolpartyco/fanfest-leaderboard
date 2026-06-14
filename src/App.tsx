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

const getTomorrow = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(23, 59, 59, 999)

  return tomorrow
}

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

const buildLeaderboard = ({ users, matches }: LeaderboardData) =>
  users
    .map<LeaderboardRow>((user) => {
      const correctPicks = matches.reduce((total, match) => {
        return match.picks[user.id] === getMatchWinner(match) ? total + 1 : total
      }, 0)

      return {
        user,
        points: correctPicks * pointsPerCorrectPick,
        correctPicks,
        totalMatches: matches.length,
      }
    })
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points
      }

      return right.correctPicks - left.correctPicks
    })

const getVisibleMatches = (matches: Match[]) => {
  const tomorrow = getTomorrow()

  return [...matches]
    .filter((match) => parseMatchDate(match.date, match.hour) < tomorrow)
    .sort((left, right) => {
      const rightTime = parseMatchDate(right.date, right.hour).getTime()
      const leftTime = parseMatchDate(left.date, left.hour).getTime()

      return rightTime - leftTime
    })
}

function App() {
  const leaderboard = buildLeaderboard(data)
  const leader = leaderboard[0]
  const topScore = leader?.points ?? 0
  const visibleMatches = getVisibleMatches(data.matches)
  const matchCount = visibleMatches.length

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
            {visibleMatches.map((match) => (
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
