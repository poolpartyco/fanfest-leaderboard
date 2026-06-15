// Leaderboard scoring logic operating on DB-row types.
import type { MatchRow, UserRow, PickRow } from './types'

export const pointsPerCorrectPick = 3

// Winning team id when scores differ, 'draw' when equal, null when not played.
export const getMatchWinner = (match: MatchRow): string | 'draw' | null => {
  if (match.home_score === null || match.away_score === null) {
    return null
  }

  if (match.home_score > match.away_score) {
    return match.home_team_id
  }

  if (match.away_score > match.home_score) {
    return match.away_team_id
  }

  return 'draw'
}

export type LeaderboardRow = {
  user: UserRow
  points: number
  correctPicks: number
  totalMatches: number
}

export const buildLeaderboard = (
  users: UserRow[],
  matches: MatchRow[],
  picks: PickRow[],
): LeaderboardRow[] => {
  const finishedMatches = matches.filter((match) => match.state === 'finished')

  const pickLookup = new Map<string, string>()
  picks.forEach((pick) => {
    pickLookup.set(`${pick.match_id}:${pick.user_id}`, pick.picked_team_id)
  })

  return users
    .map<LeaderboardRow>((user) => {
      const correctPicks = finishedMatches.reduce((total, match) => {
        const pickedTeamId = pickLookup.get(`${match.id}:${user.id}`)

        return pickedTeamId !== undefined && pickedTeamId === getMatchWinner(match)
          ? total + 1
          : total
      }, 0)

      return {
        user,
        points: correctPicks * pointsPerCorrectPick,
        correctPicks,
        totalMatches: finishedMatches.length,
      }
    })
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points
      }

      return right.correctPicks - left.correctPicks
    })
}
