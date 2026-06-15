import type { CSSProperties } from 'react'
import type { MatchRow, UserRow } from '../lib/types'
import { pickSide } from '../lib/designView'
import { playerColor } from '../lib/themes'
import { avatarFor } from '../lib/avatars'
import { formatKickoffBogota } from '../lib/view'
import { Flag } from './Flag'

type Props = {
  match: MatchRow
  players: UserRow[]
  picksByMatch: Record<string, Record<string, string>>
  teamLabel: (id: string) => string
  teamEmoji: (id: string) => string | undefined
  liveMinute: number
}

function Avatar({ name, index, size = 48 }: { name: string; index: number; size?: number }) {
  const src = avatarFor(name)
  const ring: CSSProperties = { '--ring': playerColor(name, index) } as CSSProperties
  return (
    <span className="ff-bc-ring" style={ring} title={name}>
      {src ? (
        <img className="ff-bc-av" src={src} width={size} height={size} alt={name} />
      ) : (
        <span className="ff-bc-av ff-bc-av--init" style={{ width: size, height: size, background: playerColor(name, index) }}>
          {name[0]}
        </span>
      )}
    </span>
  )
}

export function LiveStands({ match, players, picksByMatch, teamLabel, teamEmoji, liveMinute }: Props) {
  const sideOf = (u: UserRow) => pickSide(match, picksByMatch[match.id]?.[u.id])
  const indexOf = (u: UserRow) => players.indexOf(u)
  const home = players.filter((u) => sideOf(u) === 'home')
  const draw = players.filter((u) => sideOf(u) === 'draw')
  const away = players.filter((u) => sideOf(u) === 'away')
  const homeName = teamLabel(match.home_team_id)
  const awayName = teamLabel(match.away_team_id)
  const when = formatKickoffBogota(match.kickoff)

  return (
    <div className="ff-bc">
      <div className="ff-live-bar"><i /></div>

      <div className="ff-bc-top">
        <div className="ff-bc-glow a" /><div className="ff-bc-glow b" />
        <div className="ff-bc-min">
          <span className="ff-live-dot" />
          <span className="ff-live-label">{liveMinute}'</span>
          <span className="ff-bc-when">{when.day} · {when.time}</span>
        </div>
        <div className="ff-bc-row">
          <div className="ff-bc-team">
            <Flag teamId={match.home_team_id} emoji={teamEmoji(match.home_team_id)} size={64} />
            <b>{homeName}</b>
          </div>
          <div className="ff-bc-cs">
            <span>{match.home_score ?? 0}</span><span className="d">-</span><span>{match.away_score ?? 0}</span>
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
            {home.length === 0 && <span className="ff-bc-empty">No backers yet</span>}
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
            {away.length === 0 && <span className="ff-bc-empty">No backers yet</span>}
            {away.map((u) => <Avatar key={u.id} name={u.name} index={indexOf(u)} />)}
          </div>
        </div>
      </div>
    </div>
  )
}
