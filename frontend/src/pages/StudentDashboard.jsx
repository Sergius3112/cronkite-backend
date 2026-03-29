import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'
import { CheckCircle, AlertCircle, X } from 'lucide-react'
import { format } from 'date-fns'
import { ArticleAnalysisCard } from '../components/articles/ArticleAnalysisCard'

function isArticleUrl(url) {
  try {
    const path = new URL(url).pathname
    return path.length > 1 // has a path beyond just "/"
  } catch {
    return false
  }
}

const FOCUS_LABELS = {
  evaluating_content:    'Evaluating Content',
  persuasion_techniques: 'Persuasion Techniques',
  online_behaviour:      'Online Behaviour',
  identifying_risks:     'Identifying Risks',
  managing_information:  'Managing Information',
}

const CRONKITE_APP = 'https://cronkite.education/app'

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
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const uniqueModules = new Set([...pending, ...completed].map(a => a.module_id)).size

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h2 className="font-serif text-ink" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px' }}>
            {firstName ? `${greeting}, ${firstName}` : 'Your Assignments'}
          </h2>
          <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '22px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — articles assigned by your teacher
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatCard label="Pending"   value={pending.length}   />
          <StatCard label="Completed" value={completed.length} />
          <StatCard label="Modules"   value={uniqueModules}    />
        </div>

        {error && <InlineError msg={error} onRetry={() => session && loadAll(session)} />}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          {[['pending','Pending'],['completed','Completed']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: 500,
              border: '1px solid rgba(26,23,20,0.1)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              background: tab === id ? '#1A1714' : '#fff',
              color: tab === id ? '#F7F3EC' : '#7A746E',
              borderColor: tab === id ? '#1A1714' : 'rgba(26,23,20,0.1)',
            }}>
              {label} <span style={{ fontSize: '10px', fontWeight: 700, marginLeft: '4px', color: tab === id ? '#C8B89A' : 'rgb(196,30,58)' }}>
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
  const cardNavigate = useNavigate()
  const article = a.articles ?? null
  const title = article?.title || a.article_title || a.article_url || a.id
  const articleUrl = a.article_url || article?.url || ''
  const score = article?.analysis?.overall_credibility_score ?? article?.analysis?.credibility_score

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', padding: '16px', marginBottom: '10px', opacity: done ? 0.7 : 1 }}
      className="flex items-start gap-3">
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, marginTop: '4px', border: '2px solid', background: done ? '#2E7D32' : 'rgba(26,23,20,0.08)', borderColor: done ? '#2E7D32' : 'rgba(26,23,20,0.2)' }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#1A1714', lineHeight: 1.4, flex: 1 }}>{title}</p>
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
            {mod.focus_point && <span style={{ fontSize: '9px', background: '#F7F3EC', border: '1px solid rgba(26,23,20,0.1)', color: '#1A1714', borderRadius: '20px', padding: '2px 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{FOCUS_LABELS[mod.focus_point] || mod.focus_point}</span>}
          </div>
        )}
        {a.due_date && <p className="text-[10px] text-ink-light mb-2">Due {format(new Date(a.due_date), 'd MMM yyyy')}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {article?.analysis && (
            <button
              onClick={onViewAnalysis}
              style={{ background: 'transparent', color: '#1A1714', border: '1px solid rgba(26,23,20,0.18)', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              View Analysis
            </button>
          )}
          {!done && articleUrl && isArticleUrl(articleUrl) && (
            <button
              onClick={() => cardNavigate(`/read?url=${encodeURIComponent(articleUrl)}`)}
              style={{ background: 'rgb(196,30,58)', color: '#fff', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Read with Cronkite
            </button>
          )}
          {!done && articleUrl && !isArticleUrl(articleUrl) && (
            <a
              href={articleUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-block', background: '#1A1714', color: '#F7F3EC', border: 'none', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", textDecoration: 'none' }}
            >
              Read article →
            </a>
          )}
          {!done && (
            <button
              onClick={onComplete} disabled={completing}
              style={{ background: 'transparent', color: '#7A746E', border: '1px solid rgba(26,23,20,0.12)', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
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
    <div style={{ background: '#1A1714', borderRadius: '10px', padding: '14px 16px' }}>
      <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#9E9488', marginBottom: '5px' }}>{label}</p>
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 700, color: '#F7F3EC', letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
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
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#B0A89E' }}>
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: '#1A1714', marginBottom: '4px' }}>{title}</p>
      <p style={{ fontSize: '12px' }}>{text}</p>
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
