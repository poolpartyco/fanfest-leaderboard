import './VoteModal.css'
import { useEffect, useState } from 'react'
import type { MatchRow, UserRow } from '../lib/types'
import { pickSide, type Side } from '../lib/designView'
import { formatKickoffBogota } from '../lib/view'
import { Flag } from './Flag'
import { VoteCountdown } from './VoteCountdown'

type Props = {
  // The day's votable fixtures, used as a queue the modal steps through.
  matches: MatchRow[]
  startIndex: number
  me: UserRow
  picksByMatch: Record<string, Record<string, string>>
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
  onCast: (match: MatchRow, side: Side) => void
  onClose: () => void
}

// Tinder-style "versus split" voting. One match at a time: tap a team half and
// it floods the arena, then seals. Your pick is the only one ever shown; others
// stay confidential until kickoff (RLS enforces it server-side).
export function VoteModal({ matches, startIndex, me, picksByMatch, teamLabel, teamEmoji, onCast, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex)
  const m = matches[idx] as MatchRow | undefined
  const savedSide = m ? pickSide(m, picksByMatch[m.id]?.[me.id]) : null

  // `picked` drives the flood/seal view. Seed it from any existing pick so
  // reopening an already-cast match shows the sealed state with a Change option.
  const [picked, setPicked] = useState<Side | null>(savedSide)
  // Reset the flood state when stepping to a different match in the queue, using
  // React's "adjust state during render" pattern (no effect, no cascading tick).
  const [trackedIdx, setTrackedIdx] = useState(idx)
  if (idx !== trackedIdx) {
    setTrackedIdx(idx)
    setPicked(savedSide)
  }

  // Esc closes the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!m) return null

  const homeName = teamLabel(m.home_team_id)
  const awayName = teamLabel(m.away_team_id)
  const when = formatKickoffBogota(m.kickoff)
  const isLast = idx >= matches.length - 1

  const choose = (side: Side) => {
    if (picked !== null) return
    onCast(m, side)
    setPicked(side)
  }
  const advance = () => { if (isLast) onClose(); else setIdx((i) => i + 1) }

  const panelCls = (side: Side) => {
    if (picked === null) return `ffv-panel ${side}`
    return `ffv-panel ${side} ${picked === side ? 'win' : 'lose'} locked`
  }

  const confirmLabel =
    picked === 'draw' ? 'Draw it is'
      : picked === 'home' ? `${homeName} to win`
        : picked === 'away' ? `${awayName} to win` : ''

  return (
    <div className="ffv-scrim" role="dialog" aria-modal="true" aria-label="Make your pick" onClick={onClose}>
      <div className="ffv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ffv-head">
          <div className="l">
            <span className="ffv-date">{when.day} · {when.time}</span>
            <span className="ffv-queue">
              Match <b>{idx + 1}</b> of {matches.length}
              <span className="ffv-qd">
                {matches.map((mm, i) => <i key={mm.id} className={i < idx ? 'on' : i === idx ? 'cur' : ''} />)}
              </span>
            </span>
          </div>
          <div className="l">
            <VoteCountdown kickoff={m.kickoff} />
            <button className="ffv-x" onClick={onClose} title="Close" aria-label="Close">✕</button>
          </div>
        </div>

        <div className="ffv-ask">{homeName} or {awayName}?</div>

        <div className="ffv-arena" key={m.id}>
          <button type="button" className={panelCls('home')} onClick={() => choose('home')} aria-label={`Pick ${homeName} to win`}>
            <span className="ffv-ptag">Home win</span>
            <span className="ffv-flagwrap"><Flag teamId={m.home_team_id} emoji={teamEmoji(m.home_team_id)} size={86} /></span>
            <span className="ffv-pname">{homeName}</span>
            {savedSide === 'home' && picked === null && <span className="ffv-mine">Your current pick</span>}
          </button>
          <button type="button" className={panelCls('away')} onClick={() => choose('away')} aria-label={`Pick ${awayName} to win`}>
            <span className="ffv-ptag">Away win</span>
            <span className="ffv-flagwrap"><Flag teamId={m.away_team_id} emoji={teamEmoji(m.away_team_id)} size={86} /></span>
            <span className="ffv-pname">{awayName}</span>
            {savedSide === 'away' && picked === null && <span className="ffv-mine">Your current pick</span>}
          </button>

          {picked === null && (
            <div className="ffv-seam">
              <button type="button" className={`ffv-draw${savedSide === 'draw' ? ' mine' : ''}`} onClick={() => choose('draw')} aria-label="Call a draw">
                <span className="x" aria-hidden="true" />DRAW<span className="x" aria-hidden="true" />
              </button>
            </div>
          )}

          {picked !== null && (
            <div className="ffv-confirm">
              {picked === 'draw'
                ? <span className="ffv-cdraw" aria-hidden="true" />
                : <span className="ffv-cflag"><Flag teamId={picked === 'home' ? m.home_team_id : m.away_team_id} emoji={teamEmoji(picked === 'home' ? m.home_team_id : m.away_team_id)} size={66} /></span>}
              <h3>{confirmLabel}</h3>
              <p><span aria-hidden="true">🔒</span> Sealed, hidden until kickoff</p>
            </div>
          )}
        </div>

        <div className="ffv-foot">
          <div className="ffv-hint">
            {picked === null
              ? <>Tap a side to back it. <b>Tap the seam</b> for a draw.</>
              : <>Locked in. Change it any time before kickoff.</>}
          </div>
          <div className="ffv-actions">
            {picked !== null && <button className="ffv-ghost" onClick={() => setPicked(null)}>Change</button>}
            <button className="ffv-primary" onClick={advance}>{isLast ? 'Done' : 'Next match →'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
