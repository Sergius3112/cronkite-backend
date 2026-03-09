import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { sb } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, BookOpen, Newspaper,
  BarChart3, Sparkles, Inbox, LogOut, Menu,
} from 'lucide-react'

const TEACHER_NAV = [
  { label: 'Dashboard',     href: '/teacher',  icon: LayoutDashboard },
  { label: 'Modules',       href: '/modules',  icon: BookOpen        },
  { label: 'Articles',      href: '/articles', icon: Newspaper       },
  { label: 'Reports',       href: '/reports',  icon: BarChart3       },
  { label: 'Updates',       href: '/updates',  icon: Sparkles        },
]

const STUDENT_NAV = [
  { label: 'Student Inbox', href: '/student',         icon: Inbox    },
  { label: 'Modules',       href: '/student/modules', icon: BookOpen },
]

function CronkiteWordmark() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="28" height="24" rx="2" stroke="#22c55e" strokeWidth="2.5" fill="none"/>
        <rect x="6" y="9" width="12" height="2" rx="1" fill="#22c55e"/>
        <rect x="6" y="13" width="20" height="2" rx="1" fill="#22c55e"/>
        <rect x="6" y="17" width="20" height="2" rx="1" fill="#22c55e"/>
        <rect x="6" y="21" width="14" height="2" rx="1" fill="#22c55e"/>
      </svg>
      <span
        aria-label="Cronkite"
        style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', fontWeight: 700, color: '#1a1a1a', position: 'relative', lineHeight: 1 }}
      >
        {'Cronk'}
        <span style={{ position: 'relative', display: 'inline-block' }}>
          {'\u0131'}
          <span
            aria-hidden="true"
            style={{ position: 'absolute', top: '-8px', left: '50%', transform: 'translateX(-50%)', color: '#22c55e', fontSize: '14px', lineHeight: 1 }}
          >
            *
          </span>
        </span>
        {'te'}
      </span>
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
            to={isStudentRoute ? '/student' : '/modules'}
            className="flex items-center min-w-0"
            onClick={() => setMobileOpen(false)}
          >
            <CronkiteWordmark />
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {items.map(({ label, href, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                to={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

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

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
