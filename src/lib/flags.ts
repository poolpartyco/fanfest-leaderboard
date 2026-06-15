// CSS-drawn circular flag definitions, ported verbatim from the Claude Design
// prototype, plus a map from our local team ids to these flag codes.
// Teams without a drawn definition fall back to their emoji (see <Flag>).

export type FlagEmblem =
  | { t: 'disc' | 'star'; color: string; f?: number }
  | { t: 'diamond' | 'tri' | 'bar' | 'canton'; color: string; f?: number }

export type FlagDef =
  | { l: 'h' | 'v'; c: string[]; em?: FlagEmblem[] }
  | { l: 'nordic'; bg: string; cross: string; inner?: string; em?: FlagEmblem[] }
  | { l: 'george'; bg: string; cross: string; em?: FlagEmblem[] }

export const FLAGS: Record<string, FlagDef> = {
  ES: { l: 'h', c: ['#aa151b', '#f1bf00', '#aa151b'] },
  CV: { l: 'h', c: ['#003893', '#003893', '#fff', '#cf2027', '#fff', '#003893', '#003893'] },
  SE: { l: 'nordic', bg: '#006aa7', cross: '#fecc00' },
  TN: { l: 'h', c: ['#e70013'], em: [{ t: 'disc', color: '#fff', f: 0.5 }, { t: 'star', color: '#e70013', f: 0.26 }] },
  CI: { l: 'v', c: ['#f77f00', '#fff', '#009e60'] },
  EC: { l: 'h', c: ['#ffdd00', '#ffdd00', '#034ea2', '#ed1c24'] },
  NL: { l: 'h', c: ['#ae1c28', '#fff', '#21468b'] },
  JP: { l: 'h', c: ['#fff'], em: [{ t: 'disc', color: '#bc002d', f: 0.5 }] },
  MA: { l: 'h', c: ['#c1272d'], em: [{ t: 'star', color: '#006233', f: 0.5 }] },
  CA: { l: 'v', c: ['#d80621', '#fff', '#fff', '#d80621'], em: [{ t: 'disc', color: '#d80621', f: 0.32 }] },
  EN: { l: 'george', bg: '#fff', cross: '#ce1124' },
  HR: { l: 'h', c: ['#ff0000', '#fff', '#171796'], em: [{ t: 'disc', color: '#fff', f: 0.28 }] },
  FR: { l: 'v', c: ['#0055a4', '#fff', '#ef4135'] },
  AU: { l: 'h', c: ['#012169'], em: [{ t: 'canton', color: '#0a1f5e' }, { t: 'star', color: '#fff', f: 0.2 }] },
  PT: { l: 'v', c: ['#006600', '#006600', '#ff0000', '#ff0000', '#ff0000'], em: [{ t: 'disc', color: '#ffe000', f: 0.24 }] },
  GH: { l: 'h', c: ['#ce1126', '#fcd116', '#006b3f'], em: [{ t: 'star', color: '#000', f: 0.32 }] },
  DE: { l: 'h', c: ['#000', '#dd0000', '#ffce00'] },
  MX: { l: 'v', c: ['#006847', '#fff', '#ce1126'], em: [{ t: 'disc', color: '#7b3f00', f: 0.2 }] },
  BR: { l: 'h', c: ['#009b3a'], em: [{ t: 'diamond', color: '#ffdf00' }, { t: 'disc', color: '#002776', f: 0.36 }] },
  RS: { l: 'h', c: ['#c6363c', '#0c4076', '#fff'], em: [{ t: 'disc', color: '#c6a04a', f: 0.2 }] },
  DK: { l: 'nordic', bg: '#c8102e', cross: '#fff' },
  US: { l: 'h', c: ['#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234'], em: [{ t: 'canton', color: '#3c3b6e' }] },
  NG: { l: 'v', c: ['#008751', '#fff', '#008751'] },
  CM: { l: 'v', c: ['#007a5e', '#ce1126', '#fcd116'], em: [{ t: 'star', color: '#fcd116', f: 0.32 }] },
  IT: { l: 'v', c: ['#009246', '#fff', '#ce2b37'] },
  CO: { l: 'h', c: ['#fcd116', '#fcd116', '#003893', '#ce1126'] },
  BE: { l: 'v', c: ['#000', '#fae042', '#ed2939'] },
  EG: { l: 'h', c: ['#ce1126', '#fff', '#000'], em: [{ t: 'disc', color: '#c09300', f: 0.24 }] },
  SA: { l: 'h', c: ['#165d31'], em: [{ t: 'bar', color: '#fff' }] },
  UY: { l: 'h', c: ['#fff', '#0038a8', '#fff', '#0038a8', '#fff'] },
  IR: { l: 'h', c: ['#239f40', '#fff', '#da0000'], em: [{ t: 'disc', color: '#da0000', f: 0.18 }] },
  NZ: { l: 'h', c: ['#00247d'], em: [{ t: 'canton', color: '#0a1f6b' }, { t: 'star', color: '#cc142b', f: 0.2 }] },
  SN: { l: 'v', c: ['#00853f', '#fdef42', '#e31b23'], em: [{ t: 'star', color: '#00853f', f: 0.3 }] },
  IQ: { l: 'h', c: ['#ce1126', '#fff', '#000'], em: [{ t: 'star', color: '#007a3d', f: 0.3 }] },
  NO: { l: 'nordic', bg: '#ba0c2f', cross: '#fff', inner: '#00205b' },
  AR: { l: 'h', c: ['#74acdf', '#fff', '#74acdf'], em: [{ t: 'disc', color: '#f6b40e', f: 0.24 }] },
  DZ: { l: 'v', c: ['#006233', '#fff'], em: [{ t: 'star', color: '#d21034', f: 0.3 }] },
  AT: { l: 'h', c: ['#ed2939', '#fff', '#ed2939'] },
  JO: { l: 'h', c: ['#000', '#fff', '#007a3d'], em: [{ t: 'tri', color: '#ce1126' }, { t: 'star', color: '#fff', f: 0.16 }] },
  // Added for our teams the prototype didn't include (easy tricolors / crosses):
  PY: { l: 'h', c: ['#d52b1e', '#fff', '#0038a8'] },
  HT: { l: 'h', c: ['#00209f', '#d21034'] },
  CZ: { l: 'h', c: ['#fff', '#d7141a'], em: [{ t: 'tri', color: '#11457e' }] },
  CH: { l: 'george', bg: '#d52b1e', cross: '#fff' },
  UZ: { l: 'h', c: ['#0099b5', '#fff', '#1eb53a'] },
}

// Local team id -> flag code. Codes not present in FLAGS fall back to emoji.
export const FLAG_CODE_BY_TEAM_ID: Record<string, string> = {
  mex: 'MX', rsa: 'ZA', kor: 'KR', cze: 'CZ', can: 'CA', bih: 'BA', usa: 'US', par: 'PY',
  qat: 'QA', sui: 'CH', bra: 'BR', mar: 'MA', hai: 'HT', sco: 'GB-SCT', aus: 'AU', tur: 'TR',
  ger: 'DE', cur: 'CW', ned: 'NL', jpn: 'JP', civ: 'CI', ecu: 'EC', swe: 'SE', tun: 'TN',
  esp: 'ES', cpv: 'CV', bel: 'BE', egy: 'EG', ksa: 'SA', uru: 'UY', irn: 'IR', nzl: 'NZ',
  fra: 'FR', sen: 'SN', irq: 'IQ', nor: 'NO', arg: 'AR', alg: 'DZ', aut: 'AT', jor: 'JO',
  por: 'PT', cod: 'CD', col: 'CO', eng: 'EN', cro: 'HR', gha: 'GH', pan: 'PA', uzb: 'UZ',
}

export const flagCodeForTeam = (teamId: string): string | undefined => FLAG_CODE_BY_TEAM_ID[teamId]
