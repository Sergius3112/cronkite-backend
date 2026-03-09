import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'

const FOCUS_LABELS = {
  evaluating_content:    'Evaluating Content',
  persuasion_techniques: 'Persuasion Techniques',
  online_behaviour:      'Online Behaviour',
  identifying_risks:     'Identifying Risks',
  managing_information:  'Managing Information',
}

const KS_LABELS = { ks2: 'KS2', ks3: 'KS3', ks4: 'KS4', ks5: 'KS5' }

export default function StudentModules() {
  const navigate = useNavigate()
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/', { replace: true }); return }
      loadModules(session)
    })
  }, [])

  async function loadModules(sess) {
    setLoading(true)
    setError(null)
    try {
      // Fetch assignments for this student, with embedded module data
      const { data, error: qErr } = await sb
        .from('assignments')
        .select('module_id, modules(id, title, focus_point, description, key_stage)')
        .eq('student_email', sess.user.email)

      if (qErr) throw qErr

      // Deduplicate by module_id; keep first occurrence
      const seen = new Set()
      const unique = (data || []).reduce((acc, row) => {
        if (row.module_id && !seen.has(row.module_id) && row.modules) {
          seen.add(row.module_id)
          acc.push(row.modules)
        }
        return acc
      }, [])

      setModules(unique)
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="font-serif text-2xl text-ink">Your Modules</h2>
        <p className="text-xs text-ink-light mt-1">Modules your teacher has assigned articles from.</p>
      </div>

      {loading && <p className="text-xs text-ink-light py-4">Loading modules…</p>}
      {error   && <InlineError msg={error} />}

      {!loading && !error && modules.length === 0 && (
        <div className="text-center py-16 text-ink-light">
          <p className="font-serif text-base text-ink mb-1">No modules yet</p>
          <p className="text-xs">Your teacher hasn't assigned any articles yet.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modules.map(mod => (
          <div key={mod.id} className="bg-paper-dark border border-border rounded-xl p-5">
            <p className="font-serif text-base text-ink mb-2">{mod.title || 'Untitled'}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {mod.focus_point && (
                <span className="bg-paper border border-border rounded-full px-2 py-0.5 text-[10px] font-semibold text-ink-mid uppercase tracking-wide">
                  {FOCUS_LABELS[mod.focus_point] || mod.focus_point}
                </span>
              )}
              {mod.key_stage && (
                <span className="bg-ink text-paper text-[10px] font-bold uppercase px-2 py-0.5 rounded">
                  {KS_LABELS[mod.key_stage] || mod.key_stage.toUpperCase()}
                </span>
              )}
            </div>
            {mod.description && (
              <p className="text-xs text-ink-mid leading-relaxed">{mod.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function InlineError({ msg }) {
  return (
    <div className="bg-red/5 border border-red/20 rounded-xl p-4 mb-4">
      <p className="text-sm text-red font-semibold mb-1">Error</p>
      <code className="text-xs text-ink-mid break-words">{msg}</code>
    </div>
  )
}
