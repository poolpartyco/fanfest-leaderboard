import type { MatchRow, UserRow } from '../lib/types'
import { pickSide } from '../lib/designView'
import { formatKickoffBogota } from '../lib/view'
import { Flag } from './Flag'
import { PlayerAvatar as Avatar } from './PlayerAvatar'
import { VoteCountdown } from './VoteCountdown'

type Props = {
  match: MatchRow
  players: UserRow[]
  picksByMatch: Record<string, Record<string, string>>
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
  onVote: () => void
}

// The next fixture's poll, shown in the banner slot when no match is live.
// Same Broadcast Stands language, but VS + kickoff instead of a score, and the
// stands show who voted for whom.
export function NextUpPoll({ match, players, picksByMatch, teamLabel, teamEmoji, onVote }: Props) {
  const sideOf = (u: UserRow) => pickSide(match, picksByMatch[match.id]?.[u.id])
  const indexOf = (u: UserRow) => players.indexOf(u)
  const home = players.filter((u) => sideOf(u) === 'home')
  const draw = players.filter((u) => sideOf(u) === 'draw')
  const away = players.filter((u) => sideOf(u) === 'away')
  const voted = home.length + draw.length + away.length
  const homeName = teamLabel(match.home_team_id)
  const awayName = teamLabel(match.away_team_id)
  const when = formatKickoffBogota(match.kickoff)
  const done = voted === players.length

  return (
    <div className="ff-bc">
      <div className="ff-live-bar"><i /></div>

      <div className="ff-bc-top">
        <div className="ff-bc-glow a" /><div className="ff-bc-glow b" />
        <div className="ff-bc-min">
          <span className="ff-bc-nexttag">Next up</span>
          <span className="ff-bc-when">{when.day} · {when.time}</span>
          <span className="ff-voted" style={{ background: done ? 'rgba(94,224,160,.14)' : 'var(--panel2)', border: `1px solid ${done ? 'rgba(94,224,160,.4)' : 'var(--line)'}`, color: done ? 'var(--good)' : 'var(--muted)' }}>{voted}/{players.length} voted</span>
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

      <div className="ff-bc-stands">
        <div className="ff-bc-stand">
          <div className="ff-bc-head"><b>{home.length}</b> backing {homeName}</div>
          <div className="ff-bc-stack">
            {home.length === 0 && <span className="ff-bc-empty">No votes yet</span>}
            {home.map((u) => <Avatar key={u.id} name={u.name} index={indexOf(u)} />)}
          </div>
        </div>
        <div className="ff-bc-stand mid">
          <div className="ff-bc-cnt">{draw.length}</div>
          <div className="ff-bc-mlabel">Draw</div>
          <div className="ff-bc-stack" style={{ marginTop: 10 }}>
            {draw.map((u) => <Avatar key={u.id} name={u.name} index={indexOf(u)} size={44} />)}
          </div>
        </div>
        <div className="ff-bc-stand r">
          <div className="ff-bc-head">backing {awayName} <b>{away.length}</b></div>
          <div className="ff-bc-stack r">
            {away.length === 0 && <span className="ff-bc-empty">No votes yet</span>}
            {away.map((u) => <Avatar key={u.id} name={u.name} index={indexOf(u)} />)}
          </div>
        </div>
      </div>

      <div className="ff-bc-foot">
        <span className="ff-bc-hint">{done ? 'Everyone is in. ' : `${players.length - voted} still to vote. `}Picks lock at <b>{when.time}</b>.</span>
        <button className="ff-bc-cta" onClick={onVote}>Change a pick</button>
      </div>
    </div>
  )
}
