import { useEffect, useState } from 'react'
import { formatCountdown } from '../lib/view'

const SOON_MS = 15 * 60 * 1000 // highlight urgency inside the last 15 minutes

// Self-contained countdown to a match kickoff. Owns its own 1s interval so the
// tick re-renders only this label, not the whole page.
export function VoteCountdown({ kickoff }: { kickoff: string }) {
  const target = new Date(kickoff).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = target - now
  const locked = remaining <= 0
  const soon = !locked && remaining < SOON_MS
  const cls = `ff-cd${locked ? ' is-locked' : soon ? ' is-soon' : ''}`

  return (
    <span className={cls} aria-live="polite">
      <span className="ff-cd-dot" aria-hidden="true" />
      {locked ? 'Picks locked' : `Locks in ${formatCountdown(remaining)}`}
    </span>
  )
}
