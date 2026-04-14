import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase'

export default function SituationRoom() {
  const [stories, setStories] = useState([])
  const [alerts, setAlerts] = useState([])
  const [recentArticles, setRecentArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [sourceCount] = useState(20)
  const [expandedStory, setExpandedStory] = useState(null)

  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return
      const token = session.access_token
      const headers = { Authorization: `Bearer ${token}` }
      const safeFetch = (url) =>
        fetch(url, { headers })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })

      Promise.all([
        safeFetch('/api/stories?limit=20').catch(e => { console.error('Stories fetch error:', e); return { stories: [] } }),
        safeFetch('/api/narrative-alerts').catch(e => { console.error('Alerts fetch error:', e); return { alerts: [] } }),
        safeFetch('/api/articles?auto_generated=true&limit=12').catch(e => { console.error('Articles fetch error:', e); return { articles: [] } }),
      ]).then(([storiesData, alertsData, articlesData]) => {
        setStories(storiesData.stories || [])
        setAlerts(alertsData.alerts || [])
        setRecentArticles(articlesData.articles || [])
        setLastUpdated(new Date())
        setLoading(false)
      })
    })
  }, [])

  const SEVERITY_COLORS = {
    high: { bg: '#FFEBEE', color: '#C62828', label: 'High' },
    medium: { bg: '#FFF8E1', color: '#E65100', label: 'Medium' },
    low: { bg: '#E8F5E9', color: '#2E7D32', label: 'Low' },
  }

  const ALERT_LABELS = {
    coordinated_framing: 'Coordinated Framing',
    narrative_shift: 'Narrative Shift',
    omission_pattern: 'Omission Pattern',
    language_convergence: 'Language Convergence',
    breaking_story: 'Breaking Story',
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(26,23,20,0.1)', borderTop: '2px solid rgb(196,30,58)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 className="font-serif" style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px', color: '#1A1714' }}>
          Situation Room
        </h2>
        <p style={{ fontSize: '13px', color: '#7A746E' }}>
          Cronkite is monitoring {sourceCount} sources — {lastUpdated ? `last updated ${lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'loading...'}
        </p>
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', marginBottom: '32px' }}>

        {/* Left — Active Stories */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#B0A89E', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(26,23,20,0.06)' }}>
            Active Stories — {stories.length}
          </div>
          {stories.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#B0A89E', background: '#fff', borderRadius: '12px', border: '1px solid rgba(26,23,20,0.08)' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: '#1A1714', marginBottom: '4px' }}>No stories yet</div>
              <div style={{ fontSize: '12px' }}>Cronkite will populate this as it monitors sources</div>
            </div>
          )}
          {stories.map(story => (
            <div key={story.id}
              onClick={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
              style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', cursor: 'pointer', transition: 'border-color 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(26,23,20,0.2)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(26,23,20,0.08)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', fontWeight: 700, color: '#1A1714', lineHeight: 1.4, flex: 1 }}>{story.headline}</div>
                <span style={{ fontSize: '10px', background: '#F7F3EC', border: '1px solid rgba(26,23,20,0.1)', borderRadius: '20px', padding: '2px 8px', color: '#7A746E', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {story.source_count} sources
                </span>
              </div>

              {/* Bias spread bar */}
              {story.bias_spread != null && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#B0A89E', marginBottom: '3px' }}>
                    <span>Left</span>
                    <span style={{ color: story.bias_spread > 60 ? 'rgb(196,30,58)' : '#B0A89E' }}>
                      {story.bias_spread > 60 ? `${story.bias_spread}pt spread` : `${story.bias_spread}pt spread`}
                    </span>
                    <span>Right</span>
                  </div>
                  <div style={{ position: 'relative', height: '5px', background: 'linear-gradient(to right, #3b82f6, rgba(26,23,20,0.08), #ef4444)', borderRadius: '3px' }}>
                    {story.bias_range_left != null && (
                      <div style={{
                        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                        height: '100%', borderRadius: '3px',
                        background: 'rgba(26,23,20,0.3)',
                        left: `${((story.bias_range_left + 100) / 200) * 100}%`,
                        width: `${(story.bias_spread / 200) * 100}%`
                      }} />
                    )}
                  </div>
                </div>
              )}

              <div style={{ fontSize: '11px', color: '#B0A89E' }}>
                {new Date(story.last_updated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {story.article_count} articles
              </div>

              {/* Expanded view */}
              {expandedStory === story.id && story.neutral_summary && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(26,23,20,0.06)' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#B0A89E', marginBottom: '6px' }}>Cronkite neutral summary</div>
                  <div style={{ fontSize: '13px', color: '#1A1714', lineHeight: 1.6 }}>{story.neutral_summary}</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right — Narrative Alerts */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#B0A89E', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(26,23,20,0.06)' }}>
            Narrative Alerts — {alerts.length}
          </div>
          {alerts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#B0A89E', background: '#fff', borderRadius: '12px', border: '1px solid rgba(26,23,20,0.08)' }}>
              <div style={{ fontSize: '13px', color: '#1A1714', marginBottom: '4px', fontFamily: "'Playfair Display', serif" }}>No alerts</div>
              <div style={{ fontSize: '12px' }}>Cronkite will flag coordinated framing and narrative patterns here</div>
            </div>
          )}
          {alerts.map(alert => {
            const sev = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.low
            return (
              <div key={alert.id} style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#1A1714' }}>{ALERT_LABELS[alert.alert_type] || alert.alert_type}</span>
                  <span style={{ fontSize: '10px', background: sev.bg, color: sev.color, borderRadius: '20px', padding: '2px 8px', fontWeight: 500 }}>{sev.label}</span>
                </div>
                {alert.stories?.headline && (
                  <div style={{ fontSize: '11px', color: '#7A746E', marginBottom: '6px', fontStyle: 'italic' }}>{alert.stories.headline}</div>
                )}
                <div style={{ fontSize: '12px', color: '#1A1714', lineHeight: 1.5, marginBottom: '8px' }}>{alert.description}</div>
                {alert.outlets_involved?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                    {(typeof alert.outlets_involved === 'string' ? JSON.parse(alert.outlets_involved) : alert.outlets_involved).map((outlet, i) => (
                      <span key={i} style={{ fontSize: '10px', background: '#F7F3EC', border: '1px solid rgba(26,23,20,0.1)', borderRadius: '4px', padding: '2px 6px', color: '#7A746E' }}>{outlet}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#B0A89E' }}>{new Date(alert.detected_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent Auto-Published Articles */}
      <div>
        <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#B0A89E', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid rgba(26,23,20,0.06)' }}>
          Recently Analysed by Cronkite
        </div>
        {recentArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#B0A89E', background: '#fff', borderRadius: '12px', border: '1px solid rgba(26,23,20,0.08)' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: '#1A1714', marginBottom: '4px' }}>No articles yet</div>
            <div style={{ fontSize: '12px' }}>Articles will appear here as Cronkite analyses them</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
            {recentArticles.map(article => (
              <div key={article.id} style={{ background: '#fff', border: '1px solid rgba(26,23,20,0.08)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '13px', fontWeight: 700, color: '#1A1714', lineHeight: 1.4, flex: 1 }}>{article.title}</div>
                  <span style={{ fontSize: '9px', background: '#1A1714', color: '#F7F3EC', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>AUTO</span>
                </div>
                <div style={{ fontSize: '11px', color: '#7A746E', marginBottom: '8px' }}>{article.source || article.monitoring_source}</div>
                {article.analysis?.bias_direction != null && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ position: 'relative', height: '4px', background: 'linear-gradient(to right, #3b82f6, rgba(26,23,20,0.08), #ef4444)', borderRadius: '2px' }}>
                      <div style={{
                        position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
                        width: '10px', height: '10px', background: '#1A1714', borderRadius: '50%',
                        border: '2px solid #F7F3EC',
                        left: `${((article.analysis.bias_direction + 100) / 200) * 100}%`
                      }} />
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <a href={`/read?url=${encodeURIComponent(article.url)}`}
                    style={{ fontSize: '11px', background: 'rgb(196,30,58)', color: '#fff', borderRadius: '6px', padding: '5px 10px', textDecoration: 'none', fontWeight: 600 }}>
                    Read with Cronkite
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
