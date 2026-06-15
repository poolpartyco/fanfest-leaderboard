// Single visual direction (Fan Fiesta), as a CSS-variable map.
import type { CSSProperties } from 'react'

export type DirectionKey = 'fiesta'

export const THEMES: Record<DirectionKey, Record<string, string>> = {
  fiesta: {
    '--bg0': '#100a1c', '--panel': '#1b1130', '--panel2': '#241640', '--line': 'rgba(255,200,240,.11)',
    '--ink': '#fdeefb', '--muted': '#cba8d8', '--faint': '#7c6690', '--accent': '#ff5fa2',
    '--accentSoft': 'rgba(255,95,162,.17)', '--gold': '#ffc24b', '--good': '#5ee0a0', '--bad': '#ff7a8a',
    '--display': "'Bricolage Grotesque', sans-serif", '--heroA': '#3a1146', '--heroB': '#160a26',
    '--glow': 'rgba(255,95,162,.34)', '--pitch': 'rgba(255,210,240,.11)', '--titlespace': '-.01em',
  },
}

export const PLAYER_COLORS: Record<string, string> = {
  Yorman: '#6ba6ff', Josue: '#54d6a0', Andres: '#f3c24b', Baena: '#ff7e94',
}

// Stable color for a player name, falling back through the palette by index.
const PALETTE = ['#6ba6ff', '#54d6a0', '#f3c24b', '#ff7e94', '#b794f6', '#4fd1c5']
export function playerColor(name: string, index = 0): string {
  return PLAYER_COLORS[name] ?? PALETTE[index % PALETTE.length]
}

export const themeStyle = (key: DirectionKey): CSSProperties => THEMES[key] as CSSProperties
