// Player avatars, bundled by Vite. Keyed by lowercased player name.
import yorman from '../assets/avatars/yorman.png'
import josue from '../assets/avatars/josue.png'
import andres from '../assets/avatars/andres.png'
import baena from '../assets/avatars/baena.png'

const AVATARS: Record<string, string> = { yorman, josue, andres, baena }

export function avatarFor(name: string): string | undefined {
  return AVATARS[name.trim().toLowerCase()]
}
