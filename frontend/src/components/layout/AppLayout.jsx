import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { sb } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BookOpen, Newspaper,
  BarChart3, Sparkles, Inbox, LogOut, Menu, Users, FileText,
} from 'lucide-react'

const TEACHER_NAV_WORKSPACE = [
  { label: 'Overview',        href: '/teacher',   icon: LayoutDashboard },
  { label: 'Analyse Content', href: '/articles',  icon: Newspaper },
  { label: 'Modules',         href: '/modules',   icon: BookOpen },
  { label: 'Students',        href: '/reports',   icon: Users },
]

const TEACHER_NAV_CONTENT = [
  { label: 'Daily Briefing',  href: '/updates',   icon: FileText },
  { label: 'For You',         href: '/for-you',   icon: Sparkles },
]

const STUDENT_NAV = [
  { label: 'Student Inbox', href: '/student',         icon: Inbox    },
  { label: 'Modules',       href: '/student/modules', icon: BookOpen },
]

function CronkiteWordmark() {
  return (
    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 700, color: '#1A1714', letterSpacing: '-0.4px' }}>
      Cronkite<span style={{ color: 'rgb(196,30,58)' }}>.</span>
    </span>
  )
}

export function AppLayout({ children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userName, setUserName] = useState('')

  // Fetch username once for display — no role logic needed
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      setUserName(session?.user?.user_metadata?.full_name || session?.user?.email || '')
    })
  }, [])

  // Nav is determined entirely by the current route
  const isStudentRoute = pathname === '/student' || pathname.startsWith('/student/')
  const items = isStudentRoute ? STUDENT_NAV : TEACHER_NAV

  async function signOut() {
    await sb.auth.signOut()
    navigate('/', { replace: true })
  }

  function SidebarContent() {
    return (
      <div className="flex flex-col h-full bg-card">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border shrink-0">
          <Link
            to={isStudentRoute ? '/student' : '/teacher'}
            className="flex items-center min-w-0"
            onClick={() => setMobileOpen(false)}
          >
            <CronkiteWordmark />
          </Link>
        </div>

        {/* Nav items */}
        {isStudentRoute ? (
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            {items.map(({ label, href, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '8px 12px', fontSize: '13px', borderRadius: '0',
                    borderLeft: active ? '2px solid rgb(196,30,58)' : '2px solid transparent',
                    background: active ? '#F7F3EC' : 'transparent',
                    color: active ? '#1A1714' : '#7A746E',
                    fontWeight: active ? 500 : 400,
                    textDecoration: 'none', transition: 'all 0.1s',
                  }}
                >
                  <Icon style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                  {label}
                </Link>
              )
            })}
          </nav>
        ) : (
          <nav className="flex-1 px-3 py-3 overflow-y-auto">
            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#B0A89E', padding: '12px 12px 5px' }}>Workspace</p>
            {TEACHER_NAV_WORKSPACE.map(({ label, href, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} to={href} onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '8px 12px', fontSize: '13px', borderRadius: '0',
                    borderLeft: active ? '2px solid rgb(196,30,58)' : '2px solid transparent',
                    background: active ? '#F7F3EC' : 'transparent',
                    color: active ? '#1A1714' : '#7A746E',
                    fontWeight: active ? 500 : 400,
                    textDecoration: 'none', transition: 'all 0.1s',
                  }}
                >
                  <Icon style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                  {label}
                </Link>
              )
            })}
            <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#B0A89E', padding: '14px 12px 5px' }}>Content</p>
            {TEACHER_NAV_CONTENT.map(({ label, href, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} to={href} onClick={() => setMobileOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '8px 12px', fontSize: '13px', borderRadius: '0',
                    borderLeft: active ? '2px solid rgb(196,30,58)' : '2px solid transparent',
                    background: active ? '#F7F3EC' : 'transparent',
                    color: active ? '#1A1714' : '#7A746E',
                    fontWeight: active ? 500 : 400,
                    textDecoration: 'none', transition: 'all 0.1s',
                  }}
                >
                  <Icon style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                  {label}
                </Link>
              )
            })}
          </nav>
        )}

        {/* User row */}
        <div className="px-3 pb-4 border-t border-border pt-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 text-xs text-muted-foreground truncate">{userName}</span>
            <button
              onClick={signOut}
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-56 border-r border-border z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <CronkiteWordmark />
        </div>

        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            className="flex-1 overflow-y-auto"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
}
