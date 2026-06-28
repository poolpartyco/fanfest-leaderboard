import { useMemo, useState } from 'react'
import type { KnockoutRound, MatchRow, UserRow } from '../lib/types'
import { formatKickoffBogota } from '../lib/view'
import { liveClockLabel } from '../lib/designView'
import { playerColor } from '../lib/themes'
import { ROUND_FLOW, ROUND_LABEL, bracketWinnerTeamId, slotPlaceholder } from '../lib/bracketView'
import { Flag } from './Flag'

type Props = {
  matches: MatchRow[] // knockout-stage rows only
  players: UserRow[]
  picksByMatch: Record<string, Record<string, string>>
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
  onOpenFull: () => void
}

const byKickoff = (a: MatchRow, b: MatchRow) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()

// The round to show first: the earliest round that still has an unfinished
// match (i.e. where the action is), falling back to the Round of 32.
function currentRound(matches: MatchRow[]): KnockoutRound {
  for (const r of ROUND_FLOW) {
    const inRound = matches.filter((m) => m.round === r)
    if (inRound.length && inRound.some((m) => m.state !== 'finished')) return r
  }
  return 'r32'
}

export function RoadToGlory({ matches, players, picksByMatch, teamLabel, teamEmoji, onOpenFull }: Props) {
  const byRound = useMemo(() => {
    const map = new Map<KnockoutRound, MatchRow[]>()
    for (const m of matches) {
      if (!m.round || m.round === 'third') continue
      const list = map.get(m.round) ?? []
      list.push(m)
      map.set(m.round, list)
    }
    for (const list of map.values()) list.sort(byKickoff)
    return map
  }, [matches])

  const [round, setRound] = useState<KnockoutRound>(() => currentRound(matches))
  const cards = byRound.get(round) ?? []

  const teamSlot = (m: MatchRow, where: 'home' | 'away') => {
    const id = where === 'home' ? m.home_team_id : m.away_team_id
    const winnerId = bracketWinnerTeamId(m)
    const lose = m.state === 'finished' && winnerId != null && winnerId !== id
    const score = where === 'home' ? m.home_score : m.away_score
    if (id == null) {
      const ph = where === 'home'
        ? slotPlaceholder(m.home_source_match_id, m.home_source_result)
        : slotPlaceholder(m.away_source_match_id, m.away_source_result)
      return (
        <div className="ff-rg-team is-tbd">
          <span className="ff-rg-ph">{ph}</span>
        </div>
      )
    }
    return (
      <div className={`ff-rg-team${lose ? ' lose' : ''}`}>
        <Flag teamId={id} emoji={teamEmoji(id)} size={24} />
        <span className="ff-rg-nm">{teamLabel(id)}</span>
        {score != null && <span className="ff-rg-sc">{score}</span>}
      </div>
    )
  }

  return (
    <div className="ff-rg">
      <div className="ff-rg-glow a" /><div className="ff-rg-glow b" />
      <div className="ff-rg-top">
        <div>
          <div className="ff-rg-kicker">Knockout stage</div>
          <div className="ff-rg-title">Road to Glory</div>
        </div>
        <button className="ff-rg-openbtn" onClick={onOpenFull}>Open full bracket ↗</button>
      </div>

      <div className="ff-rg-pills">
        {ROUND_FLOW.map((r) => {
          const list = byRound.get(r) ?? []
          const live = list.some((m) => m.state === 'live')
          const first = list[0]
          const sub = live ? 'live' : first ? formatKickoffBogota(first.kickoff).day : ''
          return (
            <button key={r} className={`ff-rg-pill${round === r ? ' is-active' : ''}`} onClick={() => setRound(r)}>
              {ROUND_LABEL[r]} {sub && <small>{sub}</small>}
            </button>
          )
        })}
      </div>

      <div className="ff-rg-rail">
        {cards.length === 0 && <div className="ff-rg-empty">No fixtures in this round yet.</div>}
        {cards.map((m) => {
          const live = m.state === 'live'
          const when = formatKickoffBogota(m.kickoff)
          const backers = players
            .map((u, i) => ({ u, i, pick: picksByMatch[m.id]?.[u.id] }))
            .filter((b) => b.pick !== undefined)
          return (
            <div key={m.id} className={`ff-rgc${live ? ' is-live' : ''}`}>
              {live && <div className="ff-rgc-bar"><i /></div>}
              <div className="ff-rgc-meta">
                <span className="ff-rgc-id">{m.id} · {m.round && ROUND_LABEL[m.round]}</span>
                {live
                  ? <span className="ff-rgc-live"><i className="ff-rgc-dot" />{liveClockLabel(m, Date.now())}</span>
                  : <span className="ff-rgc-when">{when.day} · {when.time}</span>}
              </div>
              {teamSlot(m, 'home')}
              {m.home_score == null && m.home_team_id != null && m.away_team_id != null && <div className="ff-rgc-vs">vs</div>}
              {m.home_team_id == null && <div className="ff-rgc-vs">vs</div>}
              {teamSlot(m, 'away')}
              <div className="ff-rgc-foot">
                <span className="ff-rgc-foot-l">Backing</span>
                <span className="ff-rgc-avs">
                  {backers.length === 0
                    ? <span className="ff-rgc-none">No picks yet</span>
                    : backers.map((b) => (
                        <span key={b.u.id} className="ff-rgc-av" style={{ background: playerColor(b.u.name, b.i) }}>{b.u.name[0]}</span>
                      ))}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
