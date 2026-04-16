import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

const BLOCKED_DOMAINS = ['tiktok.com', 'facebook.com', 'linkedin.com']

function isReadableUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    return !BLOCKED_DOMAINS.some(d => hostname.includes(d)) && new URL(url).pathname.length > 1
  } catch { return false }
}

const BIAS_COLORS = {
  left: { bg: '#E3F2FD', color: '#1565C0', label: 'Left' },
  centre: { bg: '#E8F5E9', color: '#2E7D32', label: 'Centre' },
  right: { bg: '#FFEBEE', color: '#C62828', label: 'Right' },
}

const LOADING_PHRASES = [
  "Scanning today's news…",
  'Matching to your modules…',
  'Checking sources…',
  'Reviewing credibility…',
  'Almost ready…',
]

export default function ForYou() {
  const [modules, setModules] = useState([])
  const [activeModule, setActiveModule] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState(null)
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0])

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      loadForYou(session)
    })
  }, [])

  useEffect(() => {
    if (!fetching) return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_PHRASES.length
      setLoadingPhrase(LOADING_PHRASES[i])
    }, 1500)
    return () => clearInterval(interval)
  }, [fetching])

  async function loadForYou(sess) {
    setFetching(true)
    try {
      const r = await fetch('/api/for-you', {
        headers: { Authorization: `Bearer ${sess.access_token}` }
      })
      if (!r.ok) throw new Error('Failed')
      const data = await r.json()
      const mods = data.modules || []
      setModules(mods)
      if (mods.length > 0) setActiveModule(mods[0].module_id)
    } catch {
      setError('Could not load your articles. Try again later.')
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }

  const activeModuleData = modules.find(m => m.module_id === activeModule)

  if (loading || fetching) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(26,23,20,0.1)', borderTop: '2px solid rgb(196,30,58)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: '13px', color: '#7A746E', marginTop: '14px' }}>{loadingPhrase}</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 40px' }}>
      <h2 className="font-serif" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px', color: '#1A1714' }}>
        For You
      </h2>
      <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '22px' }}>
        Articles matched to your modules — new articles added daily
      </p>

      {error && (
        <div style={{ background: '#FFEBEE', border: '1px solid rgba(196,30,58,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '13px', color: 'rgb(196,30,58)' }}>
          {error}
        </div>
      )}

      {modules.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: '#1A1714', marginBottom: '6px' }}>No modules found</div>
          <div style={{ fontSize: '13px', color: '#B0A89E' }}>Cronkite matches articles to your modules. Ask your teacher to assign you to a module.</div>
        </div>
      )}

      {modules.length > 0 && (
        <>
          {/* Module tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {modules.map(mod => (
              <button
                key={mod.module_id}
                onClick={() => setActiveModule(mod.module_id)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                  border: '1px solid rgba(26,23,20,0.1)', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", transition: 'all 0.1s',
                  background: activeModule === mod.module_id ? '#1A1714' : '#fff',
                  color: activeModule === mod.module_id ? '#F7F3EC' : '#7A746E',
                  borderColor: activeModule === mod.module_id ? '#1A1714' : 'rgba(26,23,20,0.1)',
                }}
              >
                {mod.module_title}
                <span style={{ fontSize: '10px', fontWeight: 700, marginLeft: '6px', color: activeModule === mod.module_id ? '#C8B89A' : 'rgb(196,30,58)' }}>
                  {mod.articles?.length || 0}
                </span>
              </button>
            ))}
          </div>

          {/* Articles for active module */}
          {activeModuleData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeModuleData.articles?.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#B0A89E', background: '#fff', borderRadius: '12px', border: '1px solid rgba(26,23,20,0.08)' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: '#1A1714', marginBottom: '4px' }}>No articles yet</div>
                  <div style={{ fontSize: '12px' }}>Cronkite will find articles for this module shortly.</div>
                </div>
              )}
              {activeModuleData.articles?.map((article, i) => {
                const bias = BIAS_COLORS[article.bias] || BIAS_COLORS.centre
                return (
                  <div key={i}
                    style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', padding: '16px 18px', transition: 'border-color 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(26,23,20,0.2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(26,23,20,0.08)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                      <a href={article.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', fontWeight: 700, color: '#1A1714', lineHeight: 1.4, flex: 1, textDecoration: 'none' }}
                        onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                        onMouseLeave={e => e.target.style.textDecoration = 'none'}
                      >
                        {article.title}
                      </a>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: 500, whiteSpace: 'nowrap', background: bias.bg, color: bias.color }}>
                        {bias.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#7A746E', marginBottom: '4px' }}>{article.source}</div>
                    <div style={{ fontSize: '12px', color: '#7A746E', marginBottom: '10px', lineHeight: 1.5 }}>{article.reason}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {isReadableUrl(article.url) ? (
                        <a href={`/read?url=${encodeURIComponent(article.url)}`}
                          style={{ background: 'rgb(196,30,58)', color: '#fff', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                          Read with Cronkite →
                        </a>
                      ) : (
                        <a href={article.url} target="_blank" rel="noopener noreferrer"
                          style={{ background: '#1A1714', color: '#F7F3EC', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                          Read article →
                        </a>
                      )}
                      {article.has_conversation && (
                        <span style={{ fontSize: '11px', color: '#7A746E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgb(196,30,58)', display: 'inline-block' }} />
                          Conversation saved
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: '#B0A89E', marginLeft: 'auto' }}>
                        Added {new Date(article.date_added).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </main>
  )
}
