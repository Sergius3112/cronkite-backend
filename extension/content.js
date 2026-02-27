// Listens for messages from popup and shows the results sidebar

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showSidebar') {
    showSidebar(message.data);
  }
});

function showSidebar(data) {
  // Remove existing sidebar if present
  const existing = document.getElementById('factcheck-sidebar');
  if (existing) existing.remove();

  const sidebar = document.createElement('div');
  sidebar.id = 'factcheck-sidebar';

  const overallColor = getScoreColor(data.overall_score);

  sidebar.innerHTML = `
    <div class="fc-header">
      <div class="fc-header-top">
        <div class="fc-logo">🔍</div>
        <span class="fc-title">FactCheck</span>
        <button class="fc-close" id="fc-close-btn">✕</button>
      </div>
      <div class="fc-score-card">
        <div class="fc-score-circle" style="border-color: ${overallColor}; color: ${overallColor}">
          ${data.overall_score}
        </div>
        <div class="fc-score-info">
          <div class="fc-score-label">Credibility Score</div>
          <div class="fc-score-verdict" style="color: ${overallColor}">${data.verdict}</div>
          <div class="fc-score-summary">${data.summary}</div>
        </div>
      </div>
    </div>

    <div class="fc-claims-header">
      <span>📋 Claims Analysed (${data.claims.length})</span>
    </div>

    <div class="fc-claims" id="fc-claims-list">
      ${data.claims.map((claim, i) => renderClaim(claim, i)).join('')}
    </div>

    <div class="fc-footer">
      Powered by GPT-4 · Results may not be perfect
    </div>
  `;

  document.body.appendChild(sidebar);

  // Close button
  document.getElementById('fc-close-btn').addEventListener('click', () => {
    sidebar.remove();
  });

  // Push page content
  document.body.style.marginRight = '380px';
  document.body.style.transition = 'margin-right 0.3s ease';

  // Toggle claim details
  sidebar.querySelectorAll('.fc-claim').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('fc-claim-expanded');
    });
  });
}

function renderClaim(claim, index) {
  const color = getScoreColor(claim.score);
  const icon = getScoreIcon(claim.verdict);

  return `
    <div class="fc-claim">
      <div class="fc-claim-header">
        <span class="fc-claim-icon">${icon}</span>
        <span class="fc-claim-text">${escapeHtml(claim.claim)}</span>
        <span class="fc-claim-score" style="color: ${color}">${claim.score}</span>
      </div>
      <div class="fc-claim-detail">
        <div class="fc-verdict-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color}40">
          ${claim.verdict}
        </div>
        <p class="fc-explanation">${escapeHtml(claim.explanation)}</p>
        ${claim.sources && claim.sources.length > 0 ? `
          <div class="fc-sources">
            <strong>Sources considered:</strong>
            <ul>${claim.sources.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function getScoreColor(score) {
  if (score >= 75) return '#48bb78';
  if (score >= 50) return '#f6ad55';
  if (score >= 25) return '#fc8181';
  return '#e53e3e';
}

function getScoreIcon(verdict) {
  const v = verdict.toLowerCase();
  if (v.includes('true') || v.includes('accurate')) return '✅';
  if (v.includes('false') || v.includes('incorrect')) return '❌';
  if (v.includes('mislead')) return '⚠️';
  if (v.includes('unverified') || v.includes('uncertain')) return '❓';
  return '🔍';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
