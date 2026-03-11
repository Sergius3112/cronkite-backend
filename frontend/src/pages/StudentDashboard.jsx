import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { CheckCircle, AlertCircle, X } from 'lucide-react'
import { format } from 'date-fns'
import { ArticleAnalysisCard } from '../components/articles/ArticleAnalysisCard'

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
  const [analysisOpen, setAnalysisOpen] = useState(null) // assignment being viewed

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
    // Step 1: fetch assignments + modules join
    const { data: assignData, error } = await sb
      .from('assignments')
      .select('*, modules(id, title, focus_point, description)')
      .eq('student_email', sess.user.email)
      .order('created_at', { ascending: false })

    if (error) throw error

    const assignments = assignData || []

    // Step 2: fetch articles separately by article_id
    const articleIds = [...new Set(assignments.map(a => a.article_id).filter(Boolean))]
    let articlesById = {}
    if (articleIds.length > 0) {
      const { data: artData } = await sb
        .from('articles').select('id, title, url, source, analysis').in('id', articleIds)
      ;(artData || []).forEach(a => { articlesById[a.id] = a })
    }

    // Step 3: merge articles into assignments
    const all = assignments.map(a => ({ ...a, articles: articlesById[a.article_id] ?? null }))

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

  return (
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
        {loading && <div className="text-xs text-ink-light py-4">Loading assignments…</div>}

        {!loading && tab === 'pending' && (
          pending.length === 0
            ? <EmptyState title="All caught up!" text="No pending assignments. Check back when your teacher adds more." />
            : <div className="flex flex-col gap-3">
                {pending.map(a => (
                  <AssignmentCard
                    key={a.id} assignment={a}
                    mod={moduleMap[a.module_id]}
                    completing={completing[a.id]}
                    onComplete={() => markComplete(a)}
                    onViewAnalysis={() => setAnalysisOpen(a)}
                  />
                ))}
              </div>
        )}

        {!loading && tab === 'completed' && (
          completed.length === 0
            ? <EmptyState title="Nothing completed yet" text="Mark assignments as complete after analysing them." />
            : <div className="flex flex-col gap-3">
                {completed.map(a => (
                  <AssignmentCard
                    key={a.id} assignment={a}
                    mod={moduleMap[a.module_id]}
                    done
                    onViewAnalysis={() => setAnalysisOpen(a)}
                  />
                ))}
              </div>
        )}

        {/* Analysis modal */}
        {analysisOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
              <div className="flex items-start justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="font-serif text-base text-ink font-semibold leading-snug">
                    {analysisOpen.articles?.title || analysisOpen.article_title || 'Article Analysis'}
                  </h3>
                  {(analysisOpen.articles?.source) && (
                    <p className="text-xs text-ink-light mt-0.5">{analysisOpen.articles.source}</p>
                  )}
                </div>
                <button
                  onClick={() => setAnalysisOpen(null)}
                  className="ml-4 p-1.5 rounded-lg text-ink-light hover:text-ink hover:bg-gray-100 transition-colors flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-5">
                {analysisOpen.articles?.analysis ? (
                  <ArticleAnalysisCard analysis={analysisOpen.articles.analysis} />
                ) : (
                  <p className="text-sm text-ink-light text-center py-8">No analysis available for this article.</p>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

function AssignmentCard({ assignment: a, mod, done, completing, onComplete, onViewAnalysis }) {
  const article = a.articles ?? null
  const title = article?.title || a.article_title || a.article_url || a.id
  const articleUrl = a.article_url || article?.url || ''
  const score = article?.analysis?.overall_credibility_score ?? article?.analysis?.credibility_score

  return (
    <div className={`bg-paper-dark border rounded-xl p-4 flex items-start gap-3 transition-opacity ${done ? 'opacity-70 border-border/50' : 'border-border'}`}>
      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 border-2 ${done ? 'bg-green border-green' : 'bg-border border-border'}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p className="text-sm font-semibold text-ink truncate">{title}</p>
          {score != null && (
            <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
              {score}%
            </span>
          )}
        </div>
        {article?.source && <p className="text-xs text-ink-light mb-1">{article.source}</p>}
        {articleUrl && <p className="text-xs text-ink-light truncate mb-2">{articleUrl}</p>}
        {mod && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[10px] font-semibold text-ink-mid">{mod.title}</span>
            {mod.focus_point && <span className="bg-paper border border-border text-[10px] font-semibold text-ink-mid uppercase tracking-wide px-2 py-0.5 rounded-full">{FOCUS_LABELS[mod.focus_point] || mod.focus_point}</span>}
          </div>
        )}
        {a.due_date && <p className="text-[10px] text-ink-light mb-2">Due {format(new Date(a.due_date), 'd MMM yyyy')}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {article?.analysis && (
            <button
              onClick={onViewAnalysis}
              className="inline-flex items-center gap-1.5 border border-border hover:border-ink text-ink-mid hover:text-ink text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              View Analysis
            </button>
          )}
          {!done && articleUrl && (
            <a
              href={`${CRONKITE_APP}?url=${encodeURIComponent(articleUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-red hover:bg-red-dark text-paper text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-px"
            >
              Open Article
            </a>
          )}
          {!done && (
            <button
              onClick={onComplete} disabled={completing}
              className="inline-flex items-center gap-1.5 border border-border hover:border-ink text-ink-mid hover:text-ink text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
            >
              {completing ? <><Spinner />Saving…</> : "I've read this"}
            </button>
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
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-border border-t-[#c8102e] rounded-full animate-spin" />
    </div>
  )
}
