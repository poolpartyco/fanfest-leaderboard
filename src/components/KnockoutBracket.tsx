import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { MatchRow } from '../lib/types'
import { formatKickoffBogota } from '../lib/view'
import { liveClockLabel } from '../lib/designView'
import { ROUND_LABEL, bracketWinnerTeamId, slotPlaceholder } from '../lib/bracketView'
import { Flag } from './Flag'

type Props = {
  matches: MatchRow[] // knockout-stage rows only
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
}

type Side = 'L' | 'R'

// One team line inside a match node: a resolved team (flag + name + score) or
// an unresolved "W74"-style placeholder.
function SlotRow({
  teamId,
  placeholder,
  score,
  penalty,
  isWinner,
  teamLabel,
  teamEmoji,
}: {
  teamId: string | null
  placeholder: string
  score: number | null
  penalty: number | null
  isWinner: boolean
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
}) {
  if (teamId == null) {
    return (
      <div className="ff-kb-row is-tbd">
        <span className="ff-kb-ph">{placeholder}</span>
        <span className="ff-kb-sc" />
      </div>
    )
  }
  return (
    <div className={`ff-kb-row${isWinner ? ' is-win' : ''}`}>
      <span className="ff-kb-flag"><Flag teamId={teamId} emoji={teamEmoji(teamId)} size={18} /></span>
      <span className="ff-kb-nm">{teamLabel(teamId)}</span>
      <span className="ff-kb-sc">
        {score == null ? '' : score}
        {penalty != null && <span className="ff-kb-pens">({penalty})</span>}
      </span>
    </div>
  )
}

function MatchCard({
  m,
  teamLabel,
  teamEmoji,
}: {
  m: MatchRow
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
}) {
  const live = m.state === 'live'
  const when = formatKickoffBogota(m.kickoff)
  const winnerId = bracketWinnerTeamId(m)
  const isFinal = m.round === 'final'
  const isThird = m.round === 'third'
  return (
    <div
      className={`ff-kb-bm${live ? ' is-live' : ''}${isFinal ? ' is-final' : ''}${isThird ? ' is-third' : ''}`}
      data-kbid={m.id}
      data-round={m.round ?? ''}
    >
      <div className="ff-kb-meta">
        <span className="ff-kb-date">{when.day}</span>
        {live ? (
          <span className="ff-kb-livetag"><i className="ff-kb-dot" />{liveClockLabel(m, Date.now())}</span>
        ) : (
          <span className="ff-kb-time">{when.time}</span>
        )}
      </div>
      <div className="ff-kb-rows">
        <SlotRow
          teamId={m.home_team_id}
          placeholder={slotPlaceholder(m.home_source_match_id, m.home_source_result)}
          score={m.home_score}
          penalty={m.penalty_home ?? null}
          isWinner={winnerId != null && winnerId === m.home_team_id}
          teamLabel={teamLabel}
          teamEmoji={teamEmoji}
        />
        <SlotRow
          teamId={m.away_team_id}
          placeholder={slotPlaceholder(m.away_source_match_id, m.away_source_result)}
          score={m.away_score}
          penalty={m.penalty_away ?? null}
          isWinner={winnerId != null && winnerId === m.away_team_id}
          teamLabel={teamLabel}
          teamEmoji={teamEmoji}
        />
      </div>
      <div className="ff-kb-id">{m.id}</div>
    </div>
  )
}

export function KnockoutBracket({ matches, teamLabel, teamEmoji }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [lines, setLines] = useState<string[]>([])
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [heads, setHeads] = useState<{ x: number; label: string }[]>([])

  const byId = new Map(matches.map((m) => [m.id, m]))
  const final = matches.find((m) => m.round === 'final')
  const third = matches.find((m) => m.round === 'third')

  // Recursively render a match and its two feeders. Children sit on the feed
  // side; the parent card on the other, so flexbox centres each parent between
  // its two children regardless of subtree height.
  const renderNode = (id: string | null | undefined, side: Side): ReactNode => {
    if (!id) return null
    const m = byId.get(id)
    if (!m) return null
    const card = <MatchCard m={m} teamLabel={teamLabel} teamEmoji={teamEmoji} />
    const hasKids = m.home_source_match_id || m.away_source_match_id
    if (!hasKids) {
      return <div key={id} className="ff-kb-node" data-leaf="1">{card}</div>
    }
    const kids = (
      <div className="ff-kb-kids">
        {renderNode(m.home_source_match_id, side)}
        {renderNode(m.away_source_match_id, side)}
      </div>
    )
    const self = <div className="ff-kb-self">{card}</div>
    return (
      <div key={id} className={`ff-kb-node ff-kb-node--${side}`}>
        {side === 'L' ? <>{kids}{self}</> : <>{self}{kids}</>}
      </div>
    )
  }

  // Measure card geometry and draw elbow connectors + round headers. Re-runs on
  // resize, on data change, and once fonts settle (which can shift widths).
  useLayoutEffect(() => {
    const root = rootRef.current
    const cols = root?.querySelector('.ff-kb-cols') as HTMLElement | null
    if (!root || !cols) return

    const draw = () => {
      const cbox = cols.getBoundingClientRect()
      setBox({ w: cbox.width, h: cbox.height })

      // connectors: link every non-third match to each of its feeders.
      const out: string[] = []
      for (const m of matches) {
        if (m.round === 'third') continue
        for (const src of [m.home_source_match_id, m.away_source_match_id]) {
          if (!src) continue
          const c = root.querySelector(`[data-kbid="${src}"]`) as HTMLElement | null
          const p = root.querySelector(`[data-kbid="${m.id}"]`) as HTMLElement | null
          if (!c || !p) continue
          const cr = c.getBoundingClientRect()
          const pr = p.getBoundingClientRect()
          const childLeft = cr.left < pr.left
          const cx = (childLeft ? cr.right : cr.left) - cbox.left
          const cy = cr.top + cr.height / 2 - cbox.top
          const px = (childLeft ? pr.left : pr.right) - cbox.left
          const py = pr.top + pr.height / 2 - cbox.top
          const mx = (cx + px) / 2
          out.push(`${cx},${cy} ${mx},${cy} ${mx},${py} ${px},${py}`)
        }
      }
      setLines(out)

      // headers: one label per column, bucketed by card centre-x.
      const buckets = new Map<number, string>()
      cols.querySelectorAll('.ff-kb-bm').forEach((el) => {
        const card = el as HTMLElement
        if (card.dataset.round === 'third') return
        const r = card.getBoundingClientRect()
        const mid = Math.round((r.left + r.width / 2 - cbox.left) / 4) * 4
        const round = card.dataset.round as keyof typeof ROUND_LABEL
        if (!buckets.has(mid) && round) buckets.set(mid, ROUND_LABEL[round])
      })
      setHeads([...buckets.entries()].map(([x, label]) => ({ x, label })))
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(cols)
    if (document.fonts?.ready) document.fonts.ready.then(draw).catch(() => {})
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  if (matches.length === 0 || !final) {
    return <div className="ff-kb-empty-state">The knockout bracket appears once the Round of 32 is set.</div>
  }

  return (
    <div className="ff-kb-board">
      <div className="ff-kb-root" ref={rootRef}>
        <div className="ff-kb-head" style={{ width: box.w }}>
          {heads.map((h) => (
            <span key={`${h.x}-${h.label}`} className="ff-kb-colhead" style={{ left: h.x }}>{h.label}</span>
          ))}
        </div>
        <div className="ff-kb-cols">
          <div className="ff-kb-half">{renderNode(final.home_source_match_id, 'L')}</div>
          <div className="ff-kb-final">
            <div className="ff-kb-final-cap">Final</div>
            <MatchCard m={final} teamLabel={teamLabel} teamEmoji={teamEmoji} />
            {third && (
              <div className="ff-kb-third">
                <div className="ff-kb-third-cap">Play-off for third place</div>
                <MatchCard m={third} teamLabel={teamLabel} teamEmoji={teamEmoji} />
              </div>
            )}
          </div>
          <div className="ff-kb-half">{renderNode(final.away_source_match_id, 'R')}</div>
        </div>
        <svg className="ff-kb-lines" width={box.w} height={box.h} style={{ width: box.w, height: box.h }} aria-hidden="true">
          {lines.map((pts, i) => <polyline key={i} points={pts} />)}
        </svg>
      </div>
    </div>
  )
}
