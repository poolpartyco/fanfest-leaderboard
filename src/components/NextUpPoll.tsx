import type { MatchRow, UserRow } from '../lib/types'
import { pickSide } from '../lib/designView'
import { formatKickoffBogota } from '../lib/view'
import { Flag } from './Flag'
import { PlayerAvatar as Avatar } from './PlayerAvatar'
import { VoteCountdown } from './VoteCountdown'

type Props = {
  match: MatchRow
  players: UserRow[]
  me: UserRow
  picksByMatch: Record<string, Record<string, string>>
  // Who has locked a pick (no team revealed) — keeps the banner confidential.
  lockedUserIds: string[]
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
  onVote: () => void
}

// The next fixture's banner when no match is live. Picks are confidential until
// kickoff, so it shows who's LOCKED IN (not their team) plus your own pick.
export function NextUpPoll({ match, players, me, picksByMatch, lockedUserIds, teamLabel, teamEmoji, onVote }: Props) {
  const locked = new Set(lockedUserIds)
  const lockedCount = players.filter((u) => locked.has(u.id)).length
  const mySide = pickSide(match, picksByMatch[match.id]?.[me.id])
  const myLabel = mySide === null ? null : mySide === 'draw' ? 'Draw' : teamLabel(mySide === 'home' ? match.home_team_id : match.away_team_id)
  const homeName = teamLabel(match.home_team_id)
  const awayName = teamLabel(match.away_team_id)
  const when = formatKickoffBogota(match.kickoff)
  const done = lockedCount === players.length

  return (
    <div className="ff-bc">
      <div className="ff-live-bar"><i /></div>

      <div className="ff-bc-top">
        <div className="ff-bc-glow a" /><div className="ff-bc-glow b" />
        <div className="ff-bc-min">
          <span className="ff-bc-nexttag">Next up</span>
          <span className="ff-bc-when">{when.day} · {when.time}</span>
          <span className="ff-voted" style={{ background: done ? 'rgba(94,224,160,.14)' : 'var(--panel2)', border: `1px solid ${done ? 'rgba(94,224,160,.4)' : 'var(--line)'}`, color: done ? 'var(--good)' : 'var(--muted)' }}>{lockedCount}/{players.length} locked in</span>
        </div>
        <div className="ff-bc-row">
          <div className="ff-bc-team">
            <Flag teamId={match.home_team_id} emoji={teamEmoji(match.home_team_id)} size={64} />
            <b>{homeName}</b>
          </div>
          <div className="ff-bc-vs">
            <span className="ff-bc-vsk">VS</span>
            <small>Kickoff {when.time}</small>
            <VoteCountdown kickoff={match.kickoff} />
          </div>
          <div className="ff-bc-team">
            <Flag teamId={match.away_team_id} emoji={teamEmoji(match.away_team_id)} size={64} />
            <b>{awayName}</b>
          </div>
        </div>
      </div>

      {/* Sealed stands: who has locked in, never which side, until kickoff. */}
      <div className="ff-bc-stands" style={{ display: 'block', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--faint)', fontSize: 13, fontWeight: 600 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          Picks are sealed until kickoff
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 22, marginTop: 16 }}>
          {players.map((u) => {
            const has = locked.has(u.id)
            return (
              <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: has ? 1 : 0.5 }}>
                <Avatar name={u.name} index={players.indexOf(u)} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{u.id === me.id ? 'You' : u.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: has ? 'var(--good)' : 'var(--faint)' }}>{has ? 'Locked in' : 'Waiting'}</span>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
          {myLabel ? <>You're backing <b style={{ color: 'var(--ink)' }}>{myLabel}</b>.</> : 'You haven\'t picked yet.'}
        </div>
      </div>

      <div className="ff-bc-foot">
        <span className="ff-bc-hint">{done ? 'Everyone is in. ' : `${players.length - lockedCount} still to lock in. `}Picks lock at <b>{when.time}</b>.</span>
        <button className="ff-bc-cta" onClick={onVote}>{myLabel ? 'Change your pick' : 'Make your pick'}</button>
      </div>
    </div>
  )
}
