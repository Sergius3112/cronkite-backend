import { createContext, useContext, useEffect, useState } from 'react'
import { sb } from './supabase'

const AuthCtx = createContext({ session: null, role: null, loading: true })

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [role, setRole]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Safety timeout — if getSession or fetchRole hangs, unblock the UI after 3s
    const timer = setTimeout(() => setLoading(false), 3000)

    sb.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timer)
      setSession(session)
      if (session) setRole(await fetchRole(session.user.id))
      setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (_e, session) => {
      setSession(session)
      setRole(session ? await fetchRole(session.user.id) : null)
    })
    return () => { clearTimeout(timer); subscription.unsubscribe() }
  }, [])

  return <AuthCtx.Provider value={{ session, role, loading }}>{children}</AuthCtx.Provider>
}

async function fetchRole(userId) {
  try {
    const { data } = await sb.from('users').select('role').eq('id', userId).single()
    return data?.role ?? 'student'
  } catch {
    return 'student'
  }
}

export const useAuth = () => useContext(AuthCtx)
