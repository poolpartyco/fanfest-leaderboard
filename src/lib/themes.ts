// The three visual directions from the design, as CSS-variable maps.
import type { CSSProperties } from 'react'

export type DirectionKey = 'editorial' | 'broadcast' | 'fiesta'

export const DIRECTIONS: { key: DirectionKey; label: string }[] = [
  { key: 'editorial', label: 'Editorial' },
  { key: 'broadcast', label: 'Broadcast' },
  { key: 'fiesta', label: 'Fiesta' },
]

export const THEMES: Record<DirectionKey, Record<string, string>> = {
  editorial: {
    '--bg0': '#070b14', '--panel': '#0e1524', '--panel2': '#121b2e', '--line': 'rgba(255,255,255,.07)',
    '--ink': '#eef3fb', '--muted': '#9fb0c9', '--faint': '#5d6b82', '--accent': '#5aa2ff',
    '--accentSoft': 'rgba(90,162,255,.14)', '--gold': '#f5c451', '--good': '#5ee0a0', '--bad': '#ff7a8a',
    '--display': "'Playfair Display', Georgia, serif", '--heroA': '#16233f', '--heroB': '#0a1322',
    '--glow': 'rgba(90,162,255,.4)', '--pitch': 'rgba(255,255,255,.08)', '--titlespace': '-.02em',
  },
  broadcast: {
    '--bg0': '#05110b', '--panel': '#0a1d14', '--panel2': '#0e2a1c', '--line': 'rgba(180,255,210,.1)',
    '--ink': '#eafff3', '--muted': '#9fc9b2', '--faint': '#5a7d6a', '--accent': '#37e07d',
    '--accentSoft': 'rgba(55,224,125,.16)', '--gold': '#ffd23f', '--good': '#5ee0a0', '--bad': '#ff7a8a',
    '--display': "'Oswald', sans-serif", '--heroA': '#0b3322', '--heroB': '#06140d',
    '--glow': 'rgba(55,224,125,.34)', '--pitch': 'rgba(200,255,220,.11)', '--titlespace': '.005em',
  },
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
