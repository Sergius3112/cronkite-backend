import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { ChevronDown, Plus, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

const FOCUS_LABELS = {
  evaluating_content:    'Evaluating Content',
  persuasion_techniques: 'Persuasion Techniques',
  online_behaviour:      'Online Behaviour',
  identifying_risks:     'Identifying Risks',
  managing_information:  'Managing Information',
}

const KS_LABELS = { ks2:'KS2', ks3:'KS3', ks4:'KS4', ks5:'KS5' }

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [modules, setModules] = useState([])
  const [recentAssignments, setRecentAssignments] = useState([])
  const [stats, setStats] = useState({ modules:0, reviews:0, assignments:0, articles:0, students:0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [moduleAssignments, setModuleAssignments] = useState({})
  const [moduleResults, setModuleResults] = useState({})

  // Create form state
  const [form, setForm] = useState({ title:'', description:'', focus_point:'', key_stage:'' })
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)

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
      await Promise.all([loadModules(sess), loadRecentAssignments(sess), loadArticleCount(sess)])
    } finally {
      setLoading(false)
    }
  }

  async function loadArticleCount(sess) {
    const { count } = await sb
      .from('articles')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', sess.user.id)
    setStats(s => ({ ...s, articles: count || 0 }))
  }

  async function loadModules(sess) {
    const { data, error } = await sb
      .from('modules')
      .select('*')
      .eq('teacher_id', sess.user.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    setModules(data || [])
    setStats(s => ({ ...s, modules: data?.length ?? 0 }))
  }

  async function loadRecentAssignments(sess) {
    // Fetch all assignments for stats, with a separate limited query for the recent list
    const [{ data: allData, error: allErr }, { data: recentData, error: recentErr }] = await Promise.all([
      sb.from('assignments').select('id, article_id, module_id, student_email, status').eq('teacher_id', sess.user.id),
      sb.from('assignments').select('*, modules(title, focus_point)').order('created_at', { ascending: false }).limit(10),
    ])
    if (allErr) { console.warn('assignments query:', allErr.message); return }
    if (recentErr) { console.warn('recent assignments query:', recentErr.message); }

    const all = allData || []
    setRecentAssignments(recentData || [])

    // Deduplicate by article_id per module for Total Assignments
    const seen = new Set()
    let uniqueCount = 0
    all.forEach(a => {
      const key = `${a.module_id}:${a.article_id}`
      if (!seen.has(key)) { seen.add(key); uniqueCount++ }
    })

    const pendingReviews = all.filter(a => a.status === 'completed').length
    const uniqueStudents = new Set(all.map(a => a.student_email).filter(Boolean)).size
    setStats(s => ({ ...s, assignments: uniqueCount, reviews: pendingReviews, students: uniqueStudents }))
  }

  async function loadModuleAssignments(moduleId) {
    const { data, error } = await sb
      .from('assignments')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true })
    if (error) throw error
    setModuleAssignments(prev => ({ ...prev, [moduleId]: data || [] }))
  }

  async function loadModuleResults(moduleId) {
    const { data: assignments } = await sb
      .from('assignments')
      .select('id')
      .eq('module_id', moduleId)
    if (!assignments?.length) { setModuleResults(prev => ({ ...prev, [moduleId]: [] })); return }
    const ids = assignments.map(a => a.id)
    const { data, error } = await sb
      .from('student_results')
      .select('*, assignments(article_title), users(name, email)')
      .in('assignment_id', ids)
      .order('completed_at', { ascending: false })
    if (error) throw error
    setModuleResults(prev => ({ ...prev, [moduleId]: data || [] }))
  }

  async function handleExpand(mod) {
    const id = mod.id
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!moduleAssignments[id]) {
      try { await loadModuleAssignments(id) } catch (e) { console.error(e) }
    }
  }

  async function handleAddAssignment(moduleId, titleEl, urlEl, emailEl) {
    const url   = urlEl.value.trim()
    const title = titleEl.value.trim()
    const email = emailEl.value.trim()
    if (!url) { alert('Please enter an article URL.'); return }
    try {
      const { error } = await sb.from('assignments').insert({
        module_id:     moduleId,
        article_url:   url,
        article_title: title || url,
        student_email: email || null,
        status:        'assigned',
      })
      if (error) throw error
      titleEl.value = ''; urlEl.value = ''; emailEl.value = ''
      await loadModuleAssignments(moduleId)
    } catch (e) { alert('Error: ' + e.message) }
  }

  async function createModule() {
    setFormError('')
    if (!form.title)       { setFormError('Module name is required.'); return }
    if (!form.focus_point) { setFormError('Please select a focus area.'); return }
    if (!form.key_stage)   { setFormError('Please select a key stage.'); return }

    setCreating(true)
    try {
      const { data: { session: fresh } } = await sb.auth.getSession()
      if (!fresh) throw new Error('Session expired — please sign in again.')
      const { error } = await sb.from('modules').insert({
        teacher_id:  fresh.user.id,
        title:       form.title,
        description: form.description || '',
        focus_point: form.focus_point,
        key_stage:   form.key_stage,
      })
      if (error) throw error
      setForm({ title:'', description:'', focus_point:'', key_stage:'' })
      await loadModules(fresh)
    } catch (e) {
      console.error('createModule:', e)
      setFormError(e.message || String(e))
    } finally {
      setCreating(false)
    }
  }

  const firstName = (session?.user?.user_metadata?.full_name || session?.user?.email || '').split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-7xl mx-auto px-8 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h2 className="font-serif text-ink" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px' }}>
            {firstName ? `${greeting}, ${firstName}` : 'Your Dashboard'}
          </h2>
          <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '0' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — manage modules, assign articles, review results
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Active Modules"    value={stats.modules}     />
          <StatCard label="Articles"          value={stats.articles}    />
          <StatCard label="Total Assignments" value={stats.assignments} />
          <StatCard label="Students"          value={stats.students}    />
          <StatCard label="Pending Reviews"   value={stats.reviews}     red />
        </div>

        {/* Modules list */}
        <SectionHd>Your Modules</SectionHd>

        {error && <InlineError msg={error} onRetry={() => session && loadAll(session)} />}

        {loading && !error && (
          <div className="text-xs text-ink-light py-4">Loading modules…</div>
        )}

        {!loading && modules.length === 0 && !error && (
          <EmptyState title="No active modules" text="Create your first module above to get started." />
        )}

        <div className="flex flex-col gap-3 mb-8">
          {modules.map(mod => (
            <ModuleCard
              key={mod.id} mod={mod}
              expanded={expandedId === mod.id}
              assignments={moduleAssignments[mod.id]}
              results={moduleResults[mod.id]}
              onToggle={() => handleExpand(mod)}
              onAddAssignment={handleAddAssignment}
              onLoadResults={() => loadModuleResults(mod.id)}
            />
          ))}
        </div>

        {/* Recent Assignments */}
        <SectionHd>Recent Assignments</SectionHd>
        {loading && <div className="text-xs text-ink-light py-4">Loading assignments…</div>}
        {!loading && recentAssignments.length === 0
          ? <EmptyState title="No assignments yet" text="Add articles inside a module." />
          : <div className="border border-border rounded-xl overflow-hidden">
              {recentAssignments.map((a, i) => (
                <div key={a.id} className={`flex items-center gap-3 px-4 py-3 ${i < recentAssignments.length-1 ? 'border-b border-border/50' : ''}`}>
                  <span className="flex-1 text-sm text-ink truncate">{a.article_title || a.article_url || a.id}</span>
                  <StatusBadge status={a.status} />
                  <span className="text-xs text-ink-light flex-shrink-0">{a.created_at ? format(new Date(a.created_at), 'd MMM') : '—'}</span>
                </div>
              ))}
            </div>
        }
      </div>
  )
}

function ModuleCard({ mod, expanded, assignments, results, onToggle, onAddAssignment, onLoadResults }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/[0.02] transition-colors"
      >
        <div className="flex-1">
          <div className="font-serif text-base text-ink mb-1">{mod.title || 'Untitled'}</div>
          <div className="flex items-center gap-2 flex-wrap">
            {mod.focus_point && <FocusBadge val={mod.focus_point} />}
            {mod.key_stage   && <span className="bg-ink text-paper text-[10px] font-bold uppercase px-2 py-0.5 rounded">{KS_LABELS[mod.key_stage] || mod.key_stage.toUpperCase()}</span>}
          </div>
        </div>
        <ChevronDown size={14} className={`text-ink-light mt-1 flex-shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-border p-4">
          {mod.description && <p className="text-xs text-ink-mid leading-relaxed mb-4">{mod.description}</p>}

          {/* Assignments */}
          <p className="text-[10px] font-semibold text-ink-light uppercase tracking-widest mb-2">Assigned Articles</p>
          {!assignments
            ? <div className="text-xs text-ink-light flex items-center gap-1.5 mb-3"><Spinner />Loading…</div>
            : assignments.length === 0
              ? <p className="text-xs text-ink-light italic mb-3">No articles assigned yet.</p>
              : <div className="flex flex-col gap-1.5 mb-4">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-center gap-2 border border-border rounded-lg px-3 py-2">
                      <span className="flex-1 text-sm text-ink truncate">{a.article_title || a.article_url}</span>
                      <StatusBadge status={a.status} />
                      {a.article_url && <a href={a.article_url} target="_blank" rel="noopener noreferrer" className="text-xs text-ink-light hover:text-red flex-shrink-0">↗</a>}
                    </div>
                  ))}
                </div>
          }

          {/* Add assignment */}
          <div className="border border-border rounded-lg p-3 mb-4">
            <p className="text-[10px] font-semibold text-ink-light uppercase tracking-wider mb-2">Add Article</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-semibold text-ink-mid uppercase tracking-wide block mb-1">Title</label>
                <input className="input-base text-xs" placeholder="BBC: Climate…" id={`t-${mod.id}`} />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-semibold text-ink-mid uppercase tracking-wide block mb-1">URL</label>
                <input className="input-base text-xs" placeholder="https://…" id={`u-${mod.id}`} />
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-semibold text-ink-mid uppercase tracking-wide block mb-1">Student Email</label>
                <input className="input-base text-xs" placeholder="student@school.edu" id={`e-${mod.id}`} />
              </div>
              <button
                className="btn-primary text-xs py-2 px-3 flex-shrink-0"
                onClick={() => {
                  const t = document.getElementById(`t-${mod.id}`)
                  const u = document.getElementById(`u-${mod.id}`)
                  const e = document.getElementById(`e-${mod.id}`)
                  onAddAssignment(mod.id, t, u, e)
                }}
              >Add</button>
            </div>
          </div>

          {/* Results */}
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-ink-light uppercase tracking-widest">Student Results</p>
              <button onClick={onLoadResults} className="text-xs text-ink-mid border border-border hover:border-ink rounded px-2 py-1 transition-colors">Load Results</button>
            </div>
            {results && (
              results.length === 0
                ? <p className="text-xs text-ink-light italic">No submissions yet.</p>
                : <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          {['Student','Article','Score','Verdict','Date'].map(h => (
                            <th key={h} className="text-left py-1.5 px-2 text-[10px] font-semibold text-ink-light uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map(r => {
                          const score = r.analysis_json?.overall_score ?? '—'
                          const verdict = r.analysis_json?.verdict ?? '—'
                          const cls = typeof score === 'number'
                            ? score >= 70 ? 'bg-green-100 text-green-800' : score >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                            : ''
                          return (
                            <tr key={r.id} className="border-b border-border/40 last:border-0">
                              <td className="py-2 px-2 text-ink-mid">{r.users?.name || r.users?.email || r.student_id}</td>
                              <td className="py-2 px-2 text-ink-mid truncate max-w-[160px]">{r.assignments?.article_title || '—'}</td>
                              <td className="py-2 px-2">{typeof score === 'number' ? <span className={`${cls} px-2 py-0.5 rounded-full text-[11px] font-bold`}>{score}</span> : '—'}</td>
                              <td className="py-2 px-2 text-ink-mid">{verdict}</td>
                              <td className="py-2 px-2 text-ink-light">{r.completed_at ? format(new Date(r.completed_at), 'd MMM') : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, red }) {
  return (
    <div style={{ background: '#1A1714', borderRadius: '10px', padding: '14px 16px' }}>
      <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9E9488', marginBottom: '5px' }}>{label}</p>
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 700, color: red ? 'rgb(196,30,58)' : '#F7F3EC', letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
    </div>
  )
}

function Field({ label, children, className='' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[11px] font-semibold text-ink-mid uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function FocusBadge({ val }) {
  const labels = { evaluating_content:'Evaluating Content', persuasion_techniques:'Persuasion Techniques', online_behaviour:'Online Behaviour', identifying_risks:'Identifying Risks', managing_information:'Managing Information' }
  return <span className="bg-paper border border-border rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-mid uppercase tracking-wide">{labels[val] || val}</span>
}

function StatusBadge({ status }) {
  const classes = { assigned:'bg-blue-100 text-blue-700', in_progress:'bg-amber-100 text-amber-700', completed:'bg-green-100 text-green-700' }
  return <span className={`${classes[status] || 'bg-gray-100 text-gray-600'} text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0`}>{status || 'assigned'}</span>
}

function SectionHd({ children }) {
  return <h3 style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#B0A89E', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid rgba(26,23,20,0.06)' }}>{children}</h3>
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
    <div className="text-center py-10 text-ink-light mb-6">
      <p className="font-serif text-base text-ink mb-1">{title}</p>
      <p className="text-xs">{text}</p>
    </div>
  )
}

function Spinner() {
  return <div className="inline-block w-3.5 h-3.5 border-2 border-border border-t-[#c8102e] rounded-full animate-spin mr-1.5 align-middle" />
}

function FullSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-border border-t-[#c8102e] rounded-full animate-spin" />
    </div>
  )
}
