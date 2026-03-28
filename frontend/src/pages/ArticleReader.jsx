import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { sb } from '../lib/supabase'

export default function ArticleReader() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const url = searchParams.get('url') || ''

  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I've read this article. Ask me anything about its bias, persuasion techniques, or the claims it makes." }
  ])
  const [input, setInput] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)

  const source = (() => {
    try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
  })()

  useEffect(() => {
    if (!url) { setLoading(false); setError('No URL provided'); return }
    fetch(`/api/read-article?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error && !data.content) { setError(data.error) }
        else { setArticle(data) }
        setLoading(false)
      })
      .catch(() => { setError('Failed to load article'); setLoading(false) })
  }, [url])

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
      const reply = data.reply || 'Sorry, I could not process that.'

      setChatHistory(prev => [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply }])
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error — please try again.' }])
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
              <div style={{ width: '24px', height: '24px', border: '2px solid rgba(26,23,20,0.1)', borderTop: '2px solid rgb(196,30,58)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: '13px', color: '#7A746E', marginTop: '14px' }}>Loading article…</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
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

          {article && (
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
              <div style={{ fontSize: '15px', lineHeight: 1.8, color: '#1A1714' }}>
                {article.content.split('\n').map((para, i) => (
                  para.trim() ? <p key={i} style={{ marginBottom: '16px' }}>{para}</p> : null
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <div style={{ background: '#1A1714', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(247,243,236,0.08)', flexShrink: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 700, color: '#F7F3EC' }}>
              Cronkite<span style={{ color: 'rgb(196,30,58)' }}>.</span>
            </div>
            <div style={{ fontSize: '11px', color: '#9E9488', marginTop: '2px' }}>Ask about this article</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

          {/* Input */}
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
