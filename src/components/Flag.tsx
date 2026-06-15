import type { CSSProperties } from 'react'
import { FLAGS, flagCodeForTeam } from '../lib/flags'

const STAR =
  'polygon(50% 2%,62% 35%,98% 35%,68% 57%,79% 92%,50% 71%,21% 92%,32% 57%,2% 35%,38% 35%)'

type Props = { teamId: string; emoji?: string; size?: number }

const badge = (size: number): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: '50%',
  overflow: 'hidden',
  position: 'relative',
  flex: '0 0 auto',
  border: '1px solid rgba(255,255,255,.2)',
  boxShadow: '0 2px 5px rgba(0,0,0,.45)',
})

// Circular, CSS-drawn flag. Falls back to the team emoji when no drawn
// definition exists for the team's flag code.
export function Flag({ teamId, emoji, size = 30 }: Props) {
  const code = flagCodeForTeam(teamId)
  const f = code ? FLAGS[code] : undefined

  if (!f) {
    return (
      <div
        style={{
          ...badge(size),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.78,
          background: '#1b2536',
        }}
        aria-hidden="true"
      >
        {emoji ?? '🏳️'}
      </div>
    )
  }

  const layers: React.ReactNode[] = []

  if (f.l === 'v' || f.l === 'h') {
    layers.push(
      <div
        key="bands"
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: f.l === 'v' ? 'row' : 'column' }}
      >
        {f.c.map((col, i) => (
          <div key={i} style={{ flex: 1, background: col }} />
        ))}
      </div>,
    )
  } else if (f.l === 'nordic') {
    layers.push(<div key="bg" style={{ position: 'absolute', inset: 0, background: f.bg }} />)
    layers.push(<div key="cv" style={{ position: 'absolute', top: 0, bottom: 0, left: '32%', width: '16%', background: f.cross }} />)
    layers.push(<div key="ch" style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: '20%', background: f.cross }} />)
    if (f.inner) {
      layers.push(<div key="iv" style={{ position: 'absolute', top: 0, bottom: 0, left: '36%', width: '8%', background: f.inner }} />)
      layers.push(<div key="ih" style={{ position: 'absolute', left: 0, right: 0, top: '45%', height: '10%', background: f.inner }} />)
    }
  } else if (f.l === 'george') {
    layers.push(<div key="bg" style={{ position: 'absolute', inset: 0, background: f.bg }} />)
    layers.push(<div key="v" style={{ position: 'absolute', top: 0, bottom: 0, left: '40%', width: '20%', background: f.cross }} />)
    layers.push(<div key="h" style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: '20%', background: f.cross }} />)
  }

  const center: CSSProperties = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }
  ;(f.em ?? []).forEach((e, i) => {
    if (e.t === 'disc') {
      layers.push(<div key={`e${i}`} style={{ ...center, width: size * (e.f ?? 0.4), height: size * (e.f ?? 0.4), borderRadius: '50%', background: e.color }} />)
    } else if (e.t === 'star') {
      layers.push(<div key={`e${i}`} style={{ ...center, width: size * (e.f ?? 0.42), height: size * (e.f ?? 0.42), background: e.color, clipPath: STAR }} />)
    } else if (e.t === 'diamond') {
      layers.push(<div key={`e${i}`} style={{ ...center, width: size * 0.6, height: size * 0.6, background: e.color, transform: 'translate(-50%,-50%) rotate(45deg)' }} />)
    } else if (e.t === 'tri') {
      layers.push(<div key={`e${i}`} style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, borderTop: `${size / 2}px solid transparent`, borderBottom: `${size / 2}px solid transparent`, borderLeft: `${size * 0.52}px solid ${e.color}` }} />)
    } else if (e.t === 'bar') {
      layers.push(<div key={`e${i}`} style={{ position: 'absolute', left: '16%', right: '16%', top: '46%', height: '9%', background: e.color, borderRadius: 2 }} />)
    } else if (e.t === 'canton') {
      layers.push(<div key={`e${i}`} style={{ position: 'absolute', left: 0, top: 0, width: '46%', height: '54%', background: e.color }} />)
    }
  })

  return (
    <div style={badge(size)} aria-hidden="true">
      {layers}
    </div>
  )
}
