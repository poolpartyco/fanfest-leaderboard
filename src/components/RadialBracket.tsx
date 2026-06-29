import './RadialBracket.css'
import { useMemo, useRef, useState, useLayoutEffect, type CSSProperties } from 'react'
import type { MatchRow, KnockoutRound } from '../lib/types'
import { bracketWinnerTeamId, slotPlaceholder } from '../lib/bracketView'
import { Flag } from './Flag'

type Props = {
  matches: MatchRow[] // knockout-stage rows only
  teamLabel: (id: string | null) => string
  teamEmoji: (id: string | null) => string | undefined
}

// Geometry in a fixed 1000x1000 viewBox; the stage scales it to fit. Radii by
// depth: rim teams -> R32 node -> R16 -> QF -> SF -> centre (final + trophy).
const VB = 1000
const C = 500
const RING = [432, 334, 248, 168, 92, 0]
const ROUND_DEPTH: Record<KnockoutRound, number> = { r32: 1, r16: 2, qf: 3, sf: 4, final: 5, third: 5 }

type State = 'win' | 'lose' | 'live' | 'idle'

type Leaf = {
  kind: 'leaf'
  teamId: string | null
  placeholder: string
  label: string
  idx: number
  angle: number
  x: number
  y: number
  state: State
}
type Node = {
  kind: 'match'
  match: MatchRow
  depth: number
  angle: number
  x: number
  y: number
  children: (Node | Leaf)[]
}

const pos = (r: number, a: number): [number, number] => [C + r * Math.cos(a), C + r * Math.sin(a)]

function matchState(m: MatchRow): State {
  if (m.state === 'live') return 'live'
  return bracketWinnerTeamId(m) ? 'win' : 'idle'
}

export function RadialBracket({ matches, teamLabel, teamEmoji }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [badgePx, setBadgePx] = useState(40)

  // Track the rendered stage size so the CSS-drawn flags scale crisply.
  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setBadgePx(Math.max(20, Math.round(el.clientWidth * 0.066)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const model = useMemo(() => {
    const byId = new Map(matches.map((m) => [m.id, m]))
    const final = matches.find((m) => m.round === 'final')
    if (!final) return null

    const leaves: Leaf[] = []

    // Build the tree from the final down through feeders; R32 matches (no
    // feeders) expand into two team-slot leaves at the rim.
    const build = (id: string | null | undefined): Node | null => {
      if (!id) return null
      const m = byId.get(id)
      if (!m) return null
      const hasFeeders = m.home_source_match_id || m.away_source_match_id
      if (hasFeeders) {
        const children = [build(m.home_source_match_id), build(m.away_source_match_id)].filter(Boolean) as (Node | Leaf)[]
        return { kind: 'match', match: m, depth: ROUND_DEPTH[m.round ?? 'r32'], angle: 0, x: 0, y: 0, children }
      }
      const winner = bracketWinnerTeamId(m)
      const live = m.state === 'live'
      const slot = (which: 'home' | 'away'): Leaf => {
        const teamId = which === 'home' ? m.home_team_id : m.away_team_id
        const placeholder = slotPlaceholder(
          which === 'home' ? m.home_source_match_id : m.away_source_match_id,
          which === 'home' ? m.home_source_result : m.away_source_result,
        )
        let state: State = 'idle'
        if (live) state = 'live'
        else if (winner && teamId) state = winner === teamId ? 'win' : 'lose'
        const leaf: Leaf = {
          kind: 'leaf', teamId, placeholder,
          label: teamId ? teamLabel(teamId) : placeholder,
          idx: leaves.length, angle: 0, x: 0, y: 0, state,
        }
        leaves.push(leaf)
        return leaf
      }
      const r32: Node = { kind: 'match', match: m, depth: 1, angle: 0, x: 0, y: 0, children: [slot('home'), slot('away')] }
      return r32
    }

    const root = build(final.id)
    if (!root || leaves.length === 0) return null

    // Assign rim angles, then resolve internal node angles bottom-up.
    const n = leaves.length
    leaves.forEach((lf) => {
      lf.angle = -Math.PI / 2 + (lf.idx / n) * 2 * Math.PI
      ;[lf.x, lf.y] = pos(RING[0], lf.angle)
    })
    const resolve = (node: Node | Leaf): void => {
      if (node.kind === 'leaf') return
      node.children.forEach(resolve)
      let sx = 0, sy = 0
      for (const ch of node.children) { sx += Math.cos(ch.angle); sy += Math.sin(ch.angle) }
      node.angle = Math.atan2(sy, sx)
      ;[node.x, node.y] = pos(RING[node.depth], node.angle)
    }
    resolve(root)

    // Edges (child -> parent) carry the child's advancing state; dots mark inner
    // junction nodes (the final node is the centre, drawn as the trophy).
    type Edge = { x1: number; y1: number; x2: number; y2: number; state: State }
    const edges: Edge[] = []
    const dots: { x: number; y: number; state: State }[] = []
    const walk = (node: Node): void => {
      for (const ch of node.children) {
        const st: State = ch.kind === 'leaf' ? ch.state : matchState(ch.match)
        edges.push({ x1: ch.x, y1: ch.y, x2: node.x, y2: node.y, state: st })
        if (ch.kind === 'match') walk(ch)
      }
      if (node.depth >= 1 && node.depth <= 4) dots.push({ x: node.x, y: node.y, state: matchState(node.match) })
    }
    walk(root)

    const champ = bracketWinnerTeamId(final)
    return { leaves, edges, dots, champion: champ }
  }, [matches, teamLabel])

  if (!model) {
    return <div className="ff-kb-empty-state">The bracket appears once the Round of 32 is set.</div>
  }

  const { leaves, edges, dots, champion } = model
  const pct = (v: number) => `${(v / VB) * 100}%`

  return (
    <div className="rb2">
      <div className="rb2-stage" ref={stageRef}>
        <svg className="rb2-lines" viewBox={`0 0 ${VB} ${VB}`} aria-hidden="true">
          {edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className={`rb2-edge is-${e.state}`} />
          ))}
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={4} className={`rb2-dot is-${d.state}`} />
          ))}
          <circle cx={C} cy={C} r={46} className="rb2-ring" />
        </svg>

        <div className="rb2-badges">
          {leaves.map((lf) => {
            const resolved = lf.teamId != null
            return (
              <div
                key={`${lf.idx}`}
                className={`rb2-badge is-${lf.state}${resolved ? '' : ' is-tbd'}`}
                style={{ left: pct(lf.x), top: pct(lf.y), width: badgePx, height: badgePx } as CSSProperties}
                tabIndex={0}
                aria-label={lf.label}
              >
                {resolved
                  ? <Flag teamId={lf.teamId} emoji={teamEmoji(lf.teamId)} size={badgePx - 4} />
                  : <span className="rb2-tbd" />}
                <span className="rb2-name">{lf.label}</span>
              </div>
            )
          })}
        </div>

        <div className="rb2-center" aria-hidden="true">
          <div className="rb2-glow" />
          <span className="rb2-trophy">🏆</span>
        </div>
      </div>

      <div className="rb2-legend">
        <span><i className="d-live" /> Live</span>
        <span><i className="d-win" /> Advances</span>
        <span><i className="d-idle" /> Awaiting</span>
        <span><i className="d-gold" /> {champion ? `Champion: ${teamLabel(champion)}` : 'The trophy'}</span>
      </div>
    </div>
  )
}
