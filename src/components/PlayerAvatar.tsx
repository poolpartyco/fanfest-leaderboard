import type { CSSProperties } from 'react'
import { playerColor } from '../lib/themes'
import { avatarFor } from '../lib/avatars'

// Circular player avatar with a color ring; falls back to the initial.
export function PlayerAvatar({ name, index, size = 48 }: { name: string; index: number; size?: number }) {
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
