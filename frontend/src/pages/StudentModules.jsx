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
        <h2 className="font-serif" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px', color: '#1A1714' }}>My Modules</h2>
        <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '22px' }}>Modules your teacher has assigned articles from</p>
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
          <div key={mod.id} style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', padding: '16px', transition: 'border-color 0.1s' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="12" height="12" rx="2" stroke="#F7F3EC" strokeWidth="1.5"/>
                <path d="M4 7h6M4 4.5h3" stroke="#F7F3EC" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 700, color: '#1A1714', marginBottom: '6px' }}>{mod.title || 'Untitled'}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {mod.focus_point && (
                <span style={{ fontSize: '9px', background: '#F7F3EC', border: '1px solid rgba(26,23,20,0.1)', color: '#1A1714', borderRadius: '20px', padding: '2px 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {FOCUS_LABELS[mod.focus_point] || mod.focus_point}
                </span>
              )}
              {mod.key_stage && (
                <span style={{ fontSize: '9px', background: '#1A1714', color: '#F7F3EC', borderRadius: '4px', padding: '2px 6px', fontWeight: 700, textTransform: 'uppercase' }}>
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
