import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'

const CRONKITE_ERRORS = [
  "Even our newsroom needs a coffee break. Try again in a moment.",
  "The printing press has jammed. Give it another go.",
  "Our fact-checkers are conferring. Please try again.",
  "Breaking news: temporary technical difficulties. Stand by.",
  "Signal lost. Adjusting the antenna...",
  "Our newsroom is a little overwhelmed. Try again shortly.",
  "This just in: something went wrong. We're on it.",
  "404: Rhetoric not found. Please retry.",
  "Cronkite is consulting its sources. One moment.",
  "We're chasing the story. Try again shortly.",
  "The press room is busy. Bear with us.",
  "Deadline pressure. Back in a moment.",
]

const LOADING_PHRASES = [
  "Scribbling first draft…",
  "Conferring with sources…",
  "Checking the facts…",
  "Consulting the editor…",
  "Reviewing the evidence…",
  "Reading between the lines…",
  "Following the story…",
  "Asking difficult questions…",
]

const WELCOME_MESSAGES = [
  "Hi! I've read this article. Ask me anything about its bias, persuasion techniques, or the claims it makes.",
  "Article loaded. What would you like to know — bias, credibility, or persuasion techniques?",
  "I've gone through this piece. Ask me anything — I'm here to help you think critically about it.",
  "Ready when you are. What do you want to dig into — the language, the framing, or the sources?",
  "This one's interesting. Ask me about the bias, the rhetoric, or anything that caught your eye.",
  "All read. What's on your mind — the claims, the framing, or who's behind this story?",
]

const BLOCKED_MESSAGES = [
  "Ink shortage — couldn't get this one. Try opening it directly.",
  "The presses have jammed. Open it directly and ask me questions.",
  "Press pass denied. Try opening the article directly.",
  "Our correspondent couldn't get access. Try the original link.",
  "Couldn't get the story — our sources are limited here.",
]

function getRandomError() {
  return CRONKITE_ERRORS[Math.floor(Math.random() * CRONKITE_ERRORS.length)]
}

// ── Helpers for ScorePanel ────────────────────────────────────────────────

function formatComponentName(key) {
  return key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

function renderParagraphWithHighlights(text, phrases) {
  if (!phrases || phrases.length === 0) return text

  const escaped = phrases.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(pattern)

  return parts.map((part, i) => {
    const isMatch = phrases.some(p => p.toLowerCase() === part.toLowerCase())
    if (isMatch) {
      return (
        <mark key={i} style={{
          background: 'rgba(196,30,58,0.18)',
          color: '#1A1714',
          padding: '1px 3px',
          borderRadius: '3px',
          fontWeight: 500,
        }}>
          {part}
        </mark>
      )
    }
    return part
  })
}

// ── ComponentBar ─────────────────────────────────────────────────────────

function ComponentBar({ label, value, max = 100, bidirectional = false }) {
  const v = typeof value === 'number' ? value : 0
  const barColour =
    bidirectional
      ? (v < 0 ? '#3D6BB0' : v > 0 ? '#B0432D' : '#7A746E')
      : (v >= 75 ? '#3F8B5F' : v >= 55 ? '#9C8838' : '#B0432D')

  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#C9C0B5', marginBottom: '3px' }}>
        <span>{label}</span>
        <span style={{ color: '#9E9488' }}>{bidirectional && v > 0 ? '+' : ''}{v}</span>
      </div>
      <div style={{ position: 'relative', height: '4px', background: 'rgba(247,243,236,0.08)', borderRadius: '2px' }}>
        {bidirectional ? (
          <div style={{
            position: 'absolute',
            left: v < 0 ? `${50 + (v / 2)}%` : '50%',
            width: `${Math.abs(v) / 2}%`,
            height: '100%',
            background: barColour,
            borderRadius: '2px',
          }} />
        ) : (
          <div style={{
            width: `${(v / max) * 100}%`,
            height: '100%',
            background: barColour,
            borderRadius: '2px',
          }} />
        )}
      </div>
    </div>
  )
}

// ── ScorePanel ────────────────────────────────────────────────────────────

function ScorePanel({ scores, loading, error, expanded, onToggleExpanded, showHighlights, onToggleHighlights }) {
  if (loading) {
    return (
      <div style={{
        background: '#FAF7F0',
        border: '1px solid rgba(26,23,20,0.08)',
        borderRadius: '10px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}>
        <div style={{
          width: '14px', height: '14px', borderRadius: '50%',
          border: '2px solid rgba(26,23,20,0.15)',
          borderTopColor: 'rgb(196,30,58)',
          animation: 'spin 0.9s linear infinite',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '12px', color: '#7A746E' }}>
          Cronkite is scoring this article…
        </span>
        <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (error || !scores || scores.analysis_failed) {
    const msg = scores?.analysis_failed
      ? "Cronkite couldn't fully analyse this article. Try opening it on the original site — Cronkite can still help you think about it."
      : "Scoring unavailable for this article."
    return (
      <div style={{
        background: '#FAF7F0',
        border: '1px solid rgba(26,23,20,0.08)',
        borderRadius: '10px',
        padding: '14px 18px',
        marginBottom: '24px',
        fontSize: '12px',
        color: '#7A746E',
      }}>
        {msg}
      </div>
    )
  }

  const credScore = scores.credibility?.score ?? 50
  const biasScore = scores.bias?.score ?? 0
  const biasLabel = scores.bias?.label ?? 'centre'
  const credBrief = scores.rationale?.credibility_brief ?? ''
  const biasBrief = scores.rationale?.bias_brief ?? ''
  const keyPhrases = scores.rationale?.key_phrases ?? []

  const biasColour =
    biasLabel.includes('left') ? '#3D6BB0' :
    biasLabel.includes('right') ? '#B0432D' :
    '#7A746E'

  const credColour =
    credScore >= 75 ? '#3F8B5F' :
    credScore >= 55 ? '#9C8838' :
    '#B0432D'

  return (
    <div style={{
      background: '#1A1714',
      borderRadius: '10px',
      marginBottom: '24px',
      overflow: 'hidden',
    }}>
      {/* Compact view */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        padding: '18px 22px',
      }}>
        {/* Credibility */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9E9488', marginBottom: '6px' }}>
            Credibility
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '36px',
            fontWeight: 700,
            color: credColour,
            lineHeight: 1,
            marginBottom: '4px',
          }}>
            {credScore}<span style={{ fontSize: '14px', color: '#7A746E', fontWeight: 400 }}>/100</span>
          </div>
          <div style={{ fontSize: '12px', color: '#C9C0B5', lineHeight: 1.5 }}>
            {credBrief}
          </div>
        </div>

        {/* Bias */}
        <div>
          <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9E9488', marginBottom: '6px' }}>
            Bias
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '24px',
            fontWeight: 700,
            color: biasColour,
            lineHeight: 1.1,
            marginBottom: '4px',
            textTransform: 'capitalize',
          }}>
            {biasLabel.replace('-', ' ')}
            <span style={{ fontSize: '14px', color: '#7A746E', fontWeight: 400, marginLeft: '8px' }}>
              ({biasScore > 0 ? '+' : ''}{biasScore})
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#C9C0B5', lineHeight: 1.5 }}>
            {biasBrief}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div style={{
        borderTop: '1px solid rgba(247,243,236,0.08)',
        padding: '10px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        {keyPhrases.length > 0 && (
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#C9C0B5',
            cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={showHighlights}
              onChange={onToggleHighlights}
              style={{ accentColor: 'rgb(196,30,58)' }}
            />
            Show me what Cronkite noticed
          </label>
        )}
        <button
          onClick={onToggleExpanded}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: '#9E9488',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {expanded ? 'Hide full analysis ↑' : 'See full analysis ↓'}
        </button>
      </div>

      {/* Expanded view */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(247,243,236,0.08)',
          padding: '20px 22px',
          background: '#13110F',
        }}>
          {/* Credibility components */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9E9488', marginBottom: '10px' }}>
              Credibility breakdown
            </div>
            {Object.entries(scores.credibility?.components || {}).map(([key, value]) => (
              <ComponentBar key={key} label={formatComponentName(key)} value={value} max={100} />
            ))}
          </div>

          {/* Bias components */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9E9488', marginBottom: '10px' }}>
              Bias breakdown
            </div>
            {Object.entries(scores.bias?.components || {}).map(([key, value]) => (
              <ComponentBar key={key} label={formatComponentName(key)} value={value} bidirectional />
            ))}
          </div>

          {/* Source trust */}
          {scores.credibility?.source_trust !== undefined && (
            <div style={{ fontSize: '12px', color: '#C9C0B5', marginBottom: '8px' }}>
              <span style={{ color: '#9E9488' }}>Source trust:</span> {scores.credibility.source_trust}/100
              {scores.source && <span style={{ color: '#9E9488' }}> ({scores.source})</span>}
            </div>
          )}

          {/* COI flags */}
          {scores.credibility?.conflict_of_interest_flags?.length > 0 && (
            <div style={{ fontSize: '12px', color: '#E5945C', marginBottom: '8px' }}>
              ⚑ Conflict of interest: {scores.credibility.conflict_of_interest_flags.join(', ')}
            </div>
          )}

          {/* Key phrases */}
          {keyPhrases.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#9E9488', marginBottom: '8px' }}>
                Phrases Cronkite flagged
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {keyPhrases.map((p, i) => (
                  <span key={i} style={{
                    background: 'rgba(247,243,236,0.08)',
                    color: '#F7F3EC',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontStyle: 'italic',
                  }}>
                    "{p}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Methodology footer */}
          <div style={{ marginTop: '16px', fontSize: '11px', color: '#7A746E', lineHeight: 1.5 }}>
            Scores from Cronkite's Truth Formula v{scores.formula_version || '1.0'}.
            Credibility weights: source 20%, claim verifiability 25%, language neutrality 20%, authorship 15%, cross-source consensus 20%.
            Bias weights: lexical 30%, source selection 25%, narrative framing 25%, omission 20%.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page component ───────────────────────────────────────────────────

export default function ArticleReader() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const url = searchParams.get('url') || ''

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chatReady, setChatReady] = useState(false)

  const [scores, setScores] = useState(null)
  const [scoresLoading, setScoresLoading] = useState(true)
  const [scoresError, setScoresError] = useState(null)
  const [scoresExpanded, setScoresExpanded] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)

  const [welcomeMessage] = useState(
    WELCOME_MESSAGES[Math.floor(Math.random() * WELCOME_MESSAGES.length)]
  )
  const [blockedMessage] = useState(
    BLOCKED_MESSAGES[Math.floor(Math.random() * BLOCKED_MESSAGES.length)]
  )
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  const source = (() => {
    try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
  })()

  // Article fetch
  useEffect(() => {
    if (!url) { setLoading(false); setError('No URL provided'); return }
    fetch(`/api/read-article?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error && !data.content) { setError(data.error) }
        setArticle(data)
        setLoading(false)
        setChatReady(true)
      })
      .catch(() => { setError('Failed to load article'); setLoading(false); setChatReady(true) })
  }, [url])

  // Scores fetch — independent of article loading
  useEffect(() => {
    if (!url) {
      setScoresLoading(false)
      return
    }
    fetch(`/api/article-scores?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error || data.blocked) {
          setScoresError(data.error || 'Scoring unavailable')
        } else if (data.analysis_failed) {
          setScores({ analysis_failed: true })
        } else {
          setScores(data)
        }
        setScoresLoading(false)
      })
      .catch(() => {
        setScoresError('Could not load scores')
        setScoresLoading(false)
      })
  }, [url])

  // Loading phrase rotation
  useEffect(() => {
    if (!loading) return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_PHRASES.length
      const el = document.getElementById('loading-phrase')
      if (el) el.textContent = LOADING_PHRASES[i]
    }, 1500)
    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)

    setMessages(prev => [...prev, { role: 'user', content: text }])

    try {
      const { data: { session } } = await sb.auth.getSession()
      const token = session?.access_token || ''

      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url,
          article_content: article?.content?.substring(0, 3000) || '',
          message: text,
          history: chatHistory,
        }),
      })
      if (!resp.ok) {
        const err = await resp.text()
        console.error('Chat error:', resp.status, err)
        throw new Error(`API error ${resp.status}`)
      }
      const data = await resp.json()
      const reply = data.reply || getRandomError()

      setChatHistory(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply }])
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: getRandomError() }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top nav */}
      <nav style={{ height: '52px', background: '#F7F3EC', borderBottom: '1px solid rgba(26,23,20,0.1)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '16px', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#7A746E', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
          ← Back
        </button>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 700, color: '#1A1714' }}>
          Cronkite<span style={{ color: 'rgb(196,30,58)' }}>.</span>
        </span>
        <span style={{ flex: 1, fontSize: '12px', color: '#B0A89E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {source}
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#7A746E', textDecoration: 'none', flexShrink: 0 }}>
          Original ↗
        </a>
      </nav>

      {/* Main area */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>
        {/* Article column */}
        <div style={{ overflowY: 'auto', background: '#ffffff', padding: '32px 48px' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '24px' }}>
              <div style={{ position: 'relative', width: '80px', height: '100px' }}>
                <div style={{ position: 'absolute', width: '70px', height: '90px', background: '#F7F3EC', border: '1px solid rgba(26,23,20,0.15)', borderRadius: '3px', transformOrigin: 'left center', animation: 'flipPage 1.5s ease-in-out infinite' }}>
                  <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ height: '6px', background: 'rgba(26,23,20,0.2)', borderRadius: '2px', width: '90%' }} />
                    <div style={{ height: '4px', background: 'rgba(26,23,20,0.1)', borderRadius: '2px', width: '70%' }} />
                    <div style={{ height: '4px', background: 'rgba(26,23,20,0.1)', borderRadius: '2px', width: '80%' }} />
                    <div style={{ height: '4px', background: 'rgba(26,23,20,0.1)', borderRadius: '2px', width: '60%' }} />
                  </div>
                </div>
                <div style={{ position: 'absolute', width: '70px', height: '90px', background: '#EDE9E2', border: '1px solid rgba(26,23,20,0.1)', borderRadius: '3px', top: '5px', left: '5px', zIndex: -1 }} />
              </div>
              <div id="loading-phrase" style={{ fontSize: '13px', color: '#7A746E', fontFamily: "'DM Sans', sans-serif" }}>
                Scribbling first draft…
              </div>
              <style>{`@keyframes flipPage{0%,100%{transform:rotateY(0deg)}50%{transform:rotateY(-20deg)}}`}</style>
            </div>
          )}

          {error && !article && (
            <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#1A1714', marginBottom: '8px' }}>Could not load article</p>
              <p style={{ fontSize: '13px', color: '#7A746E', marginBottom: '16px' }}>{error}</p>
              <a href={url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-block', background: 'rgb(196,30,58)', color: '#fff', borderRadius: '7px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                Open original article ↗
              </a>
            </div>
          )}

          {article && article.blocked && (() => {
            const status = article.access_status || 'blocked'
            const platform = article.platform

            let heading, message

            if (status === 'requires_app') {
              heading = `${platform || 'This platform'} content`
              message = `Cronkite can analyse ${platform || 'this'} content if you paste the post text below. The Cronkite mobile app (coming soon) will let you share posts directly.`
            } else if (status === 'paywalled') {
              heading = "This article is behind a paywall"
              message = "Sign in via your school's subscription to read it, then paste the article text below. Cronkite analyses pasted text the same way it analyses scraped articles."
            } else {
              heading = "We couldn't read this article"
              message = "If it's behind a paywall, sign in via your school's subscription and paste the article text below. Otherwise, you can read it on the original site."
            }

            return (
              <div style={{ maxWidth: '600px', margin: '60px auto', textAlign: 'center' }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: '#1A1714', marginBottom: '12px' }}>
                  {heading}
                </p>
                <p style={{ fontSize: '14px', color: '#7A746E', marginBottom: '24px', lineHeight: 1.6 }}>
                  {message}
                </p>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', background: 'rgb(196,30,58)', color: '#fff', borderRadius: '7px', padding: '10px 22px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                  Open original article ↗
                </a>
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#B0A89E' }}>
                  Paste-text analysis is coming in the next update.
                </div>
              </div>
            )
          })()}

          {article && !article.blocked && (() => {
            const articleParts = article.content?.split('--- READER COMMENTS ---') || []
            const mainContent = articleParts[0]
            const commentsContent = articleParts[1]
            return (
              <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgb(196,30,58)', marginBottom: '10px' }}>
                  {article.source}
                </div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 700, color: '#1A1714', lineHeight: 1.3, marginBottom: '12px', letterSpacing: '-0.3px' }}>
                  {article.title}
                </h1>
                <div style={{ fontSize: '12px', color: '#B0A89E', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid rgba(26,23,20,0.06)' }}>
                  Assigned by teacher
                </div>

                <ScorePanel
                  scores={scores}
                  loading={scoresLoading}
                  error={scoresError}
                  expanded={scoresExpanded}
                  onToggleExpanded={() => setScoresExpanded(v => !v)}
                  showHighlights={showHighlights}
                  onToggleHighlights={() => setShowHighlights(v => !v)}
                />

                <div style={{ fontSize: '15px', lineHeight: 1.8, color: '#1A1714' }}>
                  {mainContent.split('\n').map((para, i) => {
                    if (!para.trim()) return null
                    const keyPhrases = (showHighlights && scores?.rationale?.key_phrases) || []
                    return (
                      <p key={i} style={{ marginBottom: '16px' }}>
                        {renderParagraphWithHighlights(para, keyPhrases)}
                      </p>
                    )
                  })}
                </div>

                {commentsContent && (
                  <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px solid rgba(26,23,20,0.08)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', color: '#B0A89E', marginBottom: '14px' }}>
                      Reader Comments
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: 1.7, color: '#7A746E' }}>
                      {commentsContent.split('\n').map((para, i) => (
                        para.trim() ? <p key={i} style={{ marginBottom: '12px' }}>{para}</p> : null
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Chat sidebar — unchanged */}
        <div style={{ background: '#1A1714', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(247,243,236,0.08)', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 700, color: '#F7F3EC' }}>
              Cronkite<span style={{ color: 'rgb(196,30,58)' }}>.</span>
            </div>
            <div style={{ fontSize: '11px', color: '#9E9488', marginTop: '2px' }}>Ask about this article</div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chatReady && !article?.blocked && article?.content && (
              <div style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                background: 'rgba(247,243,236,0.08)',
                color: '#F7F3EC',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {welcomeMessage}
              </div>
            )}
            {chatReady && (article?.blocked || !article?.content) && (
              <div style={{
                alignSelf: 'flex-start',
                maxWidth: '85%',
                background: 'rgba(247,243,236,0.08)',
                color: '#F7F3EC',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {blockedMessage}
                <a href={article?.url || url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', marginTop: '8px', fontSize: '11px', color: 'rgb(196,30,58)', textDecoration: 'none' }}>
                  Open original →
                </a>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: msg.role === 'user' ? 'rgb(196,30,58)' : 'rgba(247,243,236,0.08)',
                color: msg.role === 'user' ? '#fff' : '#F7F3EC',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            ))}
            {sending && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: 'rgba(247,243,236,0.08)', color: '#9E9488', borderRadius: '10px', padding: '10px 12px', fontSize: '13px' }}>
                Cronkite is thinking…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{ padding: '10px', borderTop: '1px solid rgba(247,243,236,0.08)', display: 'flex', gap: '6px', flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
              placeholder="Ask about this article…"
              style={{ flex: 1, background: 'rgba(247,243,236,0.08)', border: '1px solid rgba(247,243,236,0.15)', borderRadius: '7px', padding: '8px 10px', fontSize: '13px', color: '#F7F3EC', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
            />
            <button
              onClick={sendMessage}
              disabled={sending}
              style={{ background: 'rgb(196,30,58)', color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: sending ? 0.5 : 1 }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
