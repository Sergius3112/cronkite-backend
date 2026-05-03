// ── Shared Cronkite ScorePanel ────────────────────────────────────────────
// Used by: ArticleReader (student reader), ArticleAnalysisCard (teacher modal)
// Requires canonical shape: { credibility: {...}, bias: {...}, rationale: {...} }

export function formatComponentName(key) {
  return key.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())
}

// Quote-tolerant phrase highlighting (Part G)
export function renderParagraphWithHighlights(text, phrases) {
  if (!phrases || phrases.length === 0 || !text) return text

  // Normalise smart quotes, ellipses, and dash variants on BOTH sides so matching
  // is tolerant of typographic differences between rubric output and article body.
  const normalise = (s) => s
    .replace(/[\u2018\u2019]/g, "'")   // curly single quotes → straight
    .replace(/[\u201C\u201D]/g, '"')   // curly double quotes → straight
    .replace(/\u2013|\u2014/g, '-')    // en-dash, em-dash → hyphen
    .replace(/\u2026/g, '...')          // ellipsis char → three dots

  const normalisedText = normalise(text)
  const normalisedPhrases = phrases.map(p => normalise(p)).filter(Boolean)

  const escaped = normalisedPhrases
    .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(p => p.length > 0)

  if (escaped.length === 0) return text

  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = normalisedText.split(pattern)

  return parts.map((part, i) => {
    const lower = part.toLowerCase()
    const isMatch = normalisedPhrases.some(p => p.toLowerCase() === lower)
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

export function ComponentBar({ label, value, max = 100, bidirectional = false }) {
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

export default function ScorePanel({
  scores,
  loading,
  error,
  expanded,
  onToggleExpanded,
  showHighlights,
  onToggleHighlights,
}) {
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
        {keyPhrases.length > 0 && onToggleHighlights && (
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
        {onToggleExpanded && (
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
        )}
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
              ⚑ Conflict of interest: {(scores.credibility?.conflict_of_interest_flags || []).join(', ')}
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
