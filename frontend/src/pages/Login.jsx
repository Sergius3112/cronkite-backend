import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectByRole(session)
      else setLoading(false)
    })
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      console.log('Auth state change:', _e, session?.user?.email)
      if (session) redirectByRole(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function redirectByRole(session) {
    navigate('/teacher', { replace: true })
  }

  async function handleGoogleLogin() {
    setError(null)
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    })
    if (error) setError(error.message)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border border-t-[#c8102e] rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="bg-paper-dark border border-border rounded-2xl p-12 text-center max-w-sm w-full">
        <h1 className="font-serif text-3xl text-ink mb-1">Cronkite</h1>
        <p className="text-xs text-red uppercase tracking-widest mb-8">Trusted News Intelligence</p>
        <p className="text-sm text-ink-mid leading-relaxed mb-8">
          AI-powered fact-checking and media literacy for schools.
        </p>
        {error && (
          <p className="text-sm text-red bg-red/10 border border-red/20 rounded-lg px-4 py-3 mb-4">{error}</p>
        )}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-paper border border-border hover:border-ink rounded-lg px-6 py-3 text-sm font-semibold text-ink transition-all hover:-translate-y-px"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
