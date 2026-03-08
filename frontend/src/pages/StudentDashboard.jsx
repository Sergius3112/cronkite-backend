import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { LogOut, CheckCircle, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

const FOCUS_LABELS = {
  evaluating_content:    'Evaluating Content',
  persuasion_techniques: 'Persuasion Techniques',
  online_behaviour:      'Online Behaviour',
  identifying_risks:     'Identifying Risks',
  managing_information:  'Managing Information',
}

const CRONKITE_APP = 'https://cronkite-backend-production.up.railway.app/app'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [pending, setPending] = useState([])
  const [completed, setCompleted] = useState([])
  const [moduleMap, setModuleMap] = useState({})
  const [tab, setTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState({})

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/', { replace: true }); return }
      setSession(session)
      loadAll(session)
    })
  }, [])

  async function loadAll(sess) {
    setLoading(true)
    setError(null)
    try {
      await loadAssignments(sess)
    } catch (e) {
      console.error('loadAll:', e)
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  async function loadAssignments(sess) {
    const { data, error } = await sb
      .from('assignments')
      .select('*, modules(id, name, focus_area, description)')
      .eq('student_email', sess.user.email)
      .order('created_at', { ascending: false })

    if (error) throw error

    const all = data || []
    const mMap = {}
    all.forEach(a => { if (a.modules) mMap[a.module_id] = a.modules })
    setModuleMap(mMap)

    setPending(all.filter(a => a.status === 'assigned' || a.status === 'in_progress'))
    setCompleted(all.filter(a => a.status === 'completed'))
  }

  async function markComplete(assignment) {
    setCompleting(prev => ({ ...prev, [assignment.id]: true }))
    try {
      const { data: { session: fresh } } = await sb.auth.getSession()
      if (!fresh) throw new Error('Session expired.')

      const { error: uErr } = await sb.from('student_results').upsert({
        student_id:    fresh.user.id,
        assignment_id: assignment.id,
        analysis_json: {},
        completed_at:  new Date().toISOString(),
      }, { onConflict: 'student_id,assignment_id' })

      if (uErr) throw uErr

      const { error: sErr } = await sb
        .from('assignments')
        .update({ status: 'completed' })
        .eq('id', assignment.id)

      if (sErr) console.warn('status update:', sErr.message)

      await loadAssignments(fresh)
    } catch (e) {
      console.error('markComplete:', e)
      alert('Error: ' + e.message)
    } finally {
      setCompleting(prev => ({ ...prev, [assignment.id]: false }))
    }
  }

  const firstName = (session?.user?.user_metadata?.full_name || session?.user?.email || '').split(' ')[0]
  const uniqueModules = new Set([...pending, ...completed].map(a => a.module_id)).size

  if (loading) return <FullSpinner />

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="bg-ink border-b-2 border-red sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-lg text-paper">Cronkite</span>
            <span className="text-xs text-red uppercase tracking-widest">Student Inbox</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-paper-darker hidden sm:block">
              {session?.user?.user_metadata?.full_name || session?.user?.email}
            </span>
            <button
              onClick={() => { sb.auth.signOut(); navigate('/', { replace: true }) }}
              className="flex items-center gap-1.5 text-paper-darker border border-[#3a3a3a] hover:border-paper-darker hover:text-paper text-xs px-3 py-1.5 rounded-md transition-all"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h2 className="font-serif text-2xl text-ink">
            {firstName ? `Hello, ${firstName}` : 'Your Assignments'}
          </h2>
          <p className="text-xs text-ink-light mt-1">Articles assigned by your teacher for fact-checking.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard label="Pending"   value={pending.length}   />
          <StatCard label="Completed" value={completed.length} />
          <StatCard label="Modules"   value={uniqueModules}    />
        </div>

        {error && <InlineError msg={error} onRetry={() => session && loadAll(session)} />}

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-paper-dark border border-border rounded-lg p-1 w-fit">
          {[['pending','Pending'],['completed','Completed']].map(([id, label]) => (
            <button
              key={id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded text-sm font-semibold transition-all ${
                tab === id
                  ? 'bg-paper text-ink shadow-sm'
                  : 'text-ink-light hover:text-ink'
              }`}
            >
              {label} <span className={`ml-1 text-[10px] font-bold ${tab===id?'text-red':'text-ink-light'}`}>
                {id === 'pending' ? pending.length : completed.length}
              </span>
            </button>
          ))}
        </div>

        {/* Assignment list */}
        {tab === 'pending' && (
          pending.length === 0
            ? <EmptyState title="All caught up!" text="No pending assignments. Check back when your teacher adds more." />
            : <div className="flex flex-col gap-3">
                {pending.map(a => (
                  <AssignmentCard
                    key={a.id} assignment={a}
                    mod={moduleMap[a.module_id]}
                    completing={completing[a.id]}
                    onComplete={() => markComplete(a)}
                  />
                ))}
              </div>
        )}

        {tab === 'completed' && (
          completed.length === 0
            ? <EmptyState title="Nothing completed yet" text="Mark assignments as complete after analysing them." />
            : <div className="flex flex-col gap-3">
                {completed.map(a => (
                  <AssignmentCard
                    key={a.id} assignment={a}
                    mod={moduleMap[a.module_id]}
                    done
                  />
                ))}
              </div>
        )}
      </div>
    </div>
  )
}

function AssignmentCard({ assignment: a, mod, done, completing, onComplete }) {
  return (
    <div className={`bg-paper-dark border rounded-xl p-4 flex items-start gap-3 transition-opacity ${done ? 'opacity-70 border-border/50' : 'border-border'}`}>
      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 border-2 ${done ? 'bg-green border-green' : 'bg-border border-border'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink mb-0.5 truncate">{a.article_title || a.article_url || a.id}</p>
        <p className="text-xs text-ink-light truncate mb-2">{a.article_url}</p>
        {mod && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[10px] font-semibold text-ink-mid">{mod.name}</span>
            {mod.focus_area && <span className="bg-paper border border-border text-[10px] font-semibold text-ink-mid uppercase tracking-wide px-2 py-0.5 rounded-full">{FOCUS_LABELS[mod.focus_area] || mod.focus_area}</span>}
          </div>
        )}
        {a.due_date && <p className="text-[10px] text-ink-light mb-2">Due {format(new Date(a.due_date), 'd MMM yyyy')}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {!done && (
            <>
              <a
                href={`${CRONKITE_APP}?url=${encodeURIComponent(a.article_url || '')}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-red hover:bg-red-dark text-paper text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-px"
              >
                Analyse with Cronkite
              </a>
              <button
                onClick={onComplete} disabled={completing}
                className="inline-flex items-center gap-1.5 border border-border hover:border-ink text-ink-mid hover:text-ink text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              >
                {completing ? <><Spinner />Saving…</> : 'Mark Complete'}
              </button>
            </>
          )}
          {done && (
            <span className="inline-flex items-center gap-1.5 text-green text-xs font-semibold">
              <CheckCircle size={12} /> Completed {a.completed_at ? format(new Date(a.completed_at), 'd MMM') : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-paper-dark border border-border rounded-xl p-4">
      <p className="text-[10px] font-semibold text-ink-light uppercase tracking-widest mb-1">{label}</p>
      <p className="font-serif text-3xl text-ink leading-none">{value}</p>
    </div>
  )
}

function InlineError({ msg, onRetry }) {
  return (
    <div className="bg-red/5 border border-red/20 rounded-xl p-4 mb-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-red text-sm font-semibold"><AlertCircle size={14} /> Error</div>
      <code className="text-xs text-ink-mid break-words">{msg}</code>
      {onRetry && <button onClick={onRetry} className="self-start text-xs bg-red text-white rounded px-3 py-1.5 hover:bg-red-dark transition-colors">Retry</button>}
    </div>
  )
}

function EmptyState({ title, text }) {
  return (
    <div className="text-center py-10 text-ink-light">
      <p className="font-serif text-base text-ink mb-1">{title}</p>
      <p className="text-xs">{text}</p>
    </div>
  )
}

function Spinner() {
  return <div className="inline-block w-3.5 h-3.5 border-2 border-border border-t-[#c8102e] rounded-full animate-spin mr-1 align-middle" />
}

function FullSpinner() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-border border-t-[#c8102e] rounded-full animate-spin" />
    </div>
  )
}
