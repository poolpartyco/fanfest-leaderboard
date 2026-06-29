import './Login.css'
import { useState, type CSSProperties } from 'react'
import { useAuth } from '../lib/auth'
import { avatarFor } from '../lib/avatars'
import { playerColor } from '../lib/themes'
import stadium from '../assets/login/stadium-night.jpg'
import flagUs from '../assets/login/flag-us.png'
import flagMx from '../assets/login/flag-mx.png'
import flagCa from '../assets/login/flag-ca.png'

const ROSTER = ['Yorman', 'Josue', 'Andres', 'Baena']

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

// The Google sign-in page (mockup direction 2). After a player authenticates,
// App maps their email to a player row; this screen only kicks off the OAuth.
export function Login({ notice }: { notice?: string }) {
  const { signInWithGoogle } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(notice ?? null)

  const onSignIn = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
      // The browser redirects to Google; if it returns here, the redirect failed.
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Could not start Google sign-in.')
    }
  }

  return (
    <div className="lg-root">
      <div className="lg-scene"><img src={stadium} alt="" /></div>

      <main className="lg-stage">
        <div className="lg-top">
          <div className="lg-crest">F</div>
          <b>FanFest</b><span>PoolParty</span>
        </div>

        <div className="lg-hosts">
          <span className="lg-flags">
            <img src={flagUs} alt="United States" />
            <img src={flagMx} alt="Mexico" />
            <img src={flagCa} alt="Canada" />
          </span>
          <b>World Cup 2026</b>
        </div>

        <h1>The table is <em>set.</em></h1>
        <p className="lg-sub">Four rivals, one bracket, zero peeking. Sign in to claim your seat and lock predictions that stay secret until kickoff.</p>

        <div className="lg-roster">
          {ROSTER.map((name, i) => {
            const src = avatarFor(name)
            return (
              <div key={name} className="lg-card" style={{ '--c': playerColor(name, i) } as CSSProperties}>
                <div className="lg-av">{src && <img src={src} alt={name} />}</div>
                <b>{name}</b><small>Contender</small>
              </div>
            )
          })}
        </div>

        <div className="lg-actions">
          <button className="lg-gbtn" type="button" onClick={onSignIn} disabled={busy}>
            <GoogleG />
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </button>
          {error
            ? <span className="lg-err">{error}</span>
            : <span className="lg-note"><span className="dot" /> Your account decides which seat is yours.</span>}
        </div>
      </main>
    </div>
  )
}
