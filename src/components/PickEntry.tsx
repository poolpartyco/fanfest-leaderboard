import { useState } from 'react'
import type { MatchRow, UserRow } from '../lib/types'
import { formatKickoffBogota } from '../lib/view'
import { submitPick } from '../lib/picks'

type Props = {
  users: UserRow[]
  upcoming: MatchRow[]
  teamLabel: (id: string) => string
  teamFlag: (id: string) => string
  picksByMatch: Record<string, Record<string, string>>
  onSubmitted: () => void
}

const DRAW_ID = 'draw'

export function PickEntry({ users, upcoming, teamLabel, teamFlag, picksByMatch, onSubmitted }: Props) {
  const [userId, setUserId] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (matchId: string, teamId: string) => {
    if (!userId) return
    setPending(`${matchId}:${teamId}`)
    setError(null)
    const { error } = await submitPick(matchId, userId, teamId)
    setPending(null)
    if (error) {
      setError(error)
      return
    }
    onSubmitted()
  }

  return (
    <article className="panel picks-panel">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Your call</p>
          <h2>Make your picks</h2>
        </div>
        <p className="panel-note">Locks at kickoff</p>
      </div>

      <div className="pick-identity">
        <span className="pick-identity-label">I am</span>
        <div className="pick-identity-chips">
          {users.map((u) => (
            <button
              key={u.id}
              type="button"
              className={`identity-chip${userId === u.id ? ' is-active' : ''}`}
              onClick={() => setUserId(u.id)}
            >
              {u.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="pick-error">{error}</p>}

      {!userId && <p className="pick-hint">Pick your name to start choosing winners.</p>}

      {userId && upcoming.length === 0 && (
        <p className="pick-hint">No upcoming matches to pick right now.</p>
      )}

      {userId && upcoming.length > 0 && (
        <div className="pick-fixtures">
          {upcoming.map((match) => {
            const current = picksByMatch[match.id]?.[userId]
            const when = formatKickoffBogota(match.kickoff)
            const options = [
              { id: match.home_team_id, label: teamLabel(match.home_team_id), flag: teamFlag(match.home_team_id) },
              { id: DRAW_ID, label: 'Draw', flag: '🤝' },
              { id: match.away_team_id, label: teamLabel(match.away_team_id), flag: teamFlag(match.away_team_id) },
            ]
            return (
              <div key={match.id} className="pick-fixture">
                <span className="pick-fixture-when">{when.day} · {when.time}</span>
                <div className="pick-options">
                  {options.map((opt) => {
                    const active = current === opt.id
                    const busy = pending === `${match.id}:${opt.id}`
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`pick-option${active ? ' is-active' : ''}${opt.id === DRAW_ID ? ' pick-option--draw' : ''}`}
                        disabled={pending !== null}
                        onClick={() => choose(match.id, opt.id)}
                      >
                        <span className="flag-icon" aria-hidden="true">{opt.flag}</span>
                        <span className="pick-option-label">{opt.label}</span>
                        {busy && <span className="pick-option-spinner" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
