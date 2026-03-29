import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

function isArticleUrl(url) {
  try {
    const path = new URL(url).pathname
    return path.length > 1 // has a path beyond just "/"
  } catch {
    return false
  }
}

const BIAS_COLORS = {
  left: { bg: '#E3F2FD', color: '#1565C0', label: 'Left' },
  centre: { bg: '#E8F5E9', color: '#2E7D32', label: 'Centre' },
  right: { bg: '#FFEBEE', color: '#C62828', label: 'Right' },
}

export default function ForYou() {
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      fetch('/api/for-you', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
        .then(r => r.json())
        .then(data => { setSuggestions(data.suggestions || []); setLoading(false) })
        .catch(() => { setError('Could not load suggestions'); setLoading(false) })
    })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(26,23,20,0.1)', borderTop: '2px solid rgb(196,30,58)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: '13px', color: '#7A746E', marginTop: '14px' }}>Finding articles for you…</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 32px' }}>
      <h2 className="font-serif" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px', color: '#1A1714' }}>For You</h2>
      <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '22px' }}>Articles matched to your modules — updated daily</p>

      {error && <div style={{ background: '#FFEBEE', border: '1px solid rgba(196,30,58,0.2)', borderRadius: '10px', padding: '14px', marginBottom: '16px', fontSize: '13px', color: 'rgb(196,30,58)' }}>{error}</div>}

      {!loading && suggestions.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: '#1A1714', marginBottom: '6px' }}>No suggestions yet</div>
          <div style={{ fontSize: '13px', color: '#B0A89E' }}>Check back tomorrow — Cronkite will find articles matched to your modules.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {suggestions.map((s, i) => {
          const bias = BIAS_COLORS[s.bias] || BIAS_COLORS.centre
          return (
            <div key={i} style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', fontWeight: 700, color: '#1A1714', lineHeight: 1.4, flex: 1 }}>{s.title}</div>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', fontWeight: 500, whiteSpace: 'nowrap', background: bias.bg, color: bias.color }}>{bias.label}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#7A746E', marginBottom: '4px' }}>{s.source}</div>
              <div style={{ fontSize: '12px', color: '#7A746E', marginBottom: '6px', lineHeight: 1.5 }}>{s.reason}</div>
              {s.module_title && <div style={{ fontSize: '10px', color: '#B0A89E', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.module_title}</div>}
              {isArticleUrl(s.url) ? (
                <a href={`/read?url=${encodeURIComponent(s.url)}`}
                  style={{ display: 'inline-block', background: 'rgb(196,30,58)', color: '#fff', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                  Read with Cronkite →
                </a>
              ) : (
                <a href={s.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', background: '#1A1714', color: '#F7F3EC', borderRadius: '7px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                  Read article →
                </a>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
