chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showSidebar') showSidebar(message.data);
});

function showSidebar(data) {
  const existing = document.getElementById('factcheck-sidebar');
  if (existing) existing.remove();

  const sidebar = document.createElement('div');
  sidebar.id = 'factcheck-sidebar';

  const overallColor = getTrafficColor(data.overall_score);
  const biasColor = getBiasColor(data.bias_score || 50);
  const biasPosition = data.bias_score || 50;
  const logoUrl = chrome.runtime.getURL('icons_white/icon128.png');
  const hasFlags = data.language_flags && data.language_flags.length > 0;

  sidebar.innerHTML = `
    <!-- Fixed top bar -->
    <div class="fc-header-top">
      <img class="fc-logo" src="${logoUrl}" alt="Cronkite">
      <button class="fc-close" id="fc-close-btn">✕</button>
    </div>

    <!-- Everything else scrolls -->
    <div class="fc-scrollable">

      <div class="fc-score-card">
        <div class="fc-score-circle" style="border-color:${overallColor}; color:${overallColor}">
          ${data.overall_score}
        </div>
        <div class="fc-score-info">
          <div class="fc-score-label">Credibility Score</div>
          <div class="fc-score-verdict">${data.verdict}</div>
          <div class="fc-score-summary">${data.summary}</div>
        </div>
      </div>

      <div class="fc-bias-card">
        <div class="fc-bias-header">
          <span class="fc-score-label">Bias Assessment</span>
          <span class="fc-bias-label" style="color:${biasColor}">${data.bias_label || 'Centre'}</span>
        </div>
        <div class="fc-bias-bar-wrap">
          <span class="fc-bias-end">Left</span>
          <div class="fc-bias-track">
            <div class="fc-bias-fill-left" style="width:${biasPosition}%"></div>
            <div class="fc-bias-fill-right" style="width:${100 - biasPosition}%"></div>
            <div class="fc-bias-needle" style="left:${biasPosition}%">
              <div class="fc-bias-needle-dot" style="background:${biasColor}"></div>
            </div>
          </div>
          <span class="fc-bias-end">Right</span>
        </div>
        ${data.bias_summary ? `<div class="fc-bias-summary">${data.bias_summary}</div>` : ''}
      </div>

      ${hasFlags ? `
        <div class="fc-flags-card">
          <div class="fc-flags-title">
            <span class="fc-score-label">Language Flags</span>
            <span class="fc-flags-count">${data.language_flags.length}</span>
          </div>
          ${data.language_flags.map(f => `
            <div class="fc-flag-item">
              <div class="fc-flag-phrase">"${escapeHtml(f.phrase)}"</div>
              <div class="fc-flag-issue">${escapeHtml(f.issue)}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="fc-claims-header">Claims Analysed — ${data.claims.length}</div>

      <div class="fc-claims">
        ${data.claims.map(claim => renderClaim(claim)).join('')}
      </div>

      <div class="fc-footer">Cronkite · Live Web Search + AI Analysis</div>

    </div>
  `;

  document.body.appendChild(sidebar);

  document.getElementById('fc-close-btn').addEventListener('click', () => {
    sidebar.remove();
    document.body.style.marginRight = '';
  });

  document.body.style.marginRight = '390px';
  document.body.style.transition = 'margin-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

  sidebar.querySelectorAll('.fc-claim').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('fc-claim-expanded'));
  });
}

function renderClaim(claim) {
  const color = getTrafficColor(claim.score);
  const hasNuance = claim.nuance && claim.nuance.trim().length > 0;
  return `
    <div class="fc-claim">
      <div class="fc-claim-header">
        <div class="fc-claim-indicator" style="background:${color}"></div>
        <span class="fc-claim-text">${escapeHtml(claim.claim)}</span>
        <span class="fc-claim-score" style="color:${color}">${claim.score}</span>
      </div>
      <div class="fc-claim-detail">
        <div class="fc-verdict-badge" style="background:${color}18; color:${color}; border-color:${color}35">
          ${claim.verdict}
        </div>
        <p class="fc-explanation">${escapeHtml(claim.explanation)}</p>
        ${hasNuance ? `
          <div class="fc-nuance">
            <div class="fc-nuance-label">Critical Analysis</div>
            <p class="fc-nuance-text">${escapeHtml(claim.nuance)}</p>
          </div>` : ''}
        ${claim.sources && claim.sources.length > 0 ? `
          <div class="fc-sources">
            <strong>Sources (${claim.sources.length})</strong>
            <ul>${claim.sources.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>
          </div>` : ''}
      </div>
    </div>`;
}

function getTrafficColor(score) {
  if (score >= 70) return '#4ade80';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getBiasColor(score) {
  if (score <= 20) return '#ef4444';
  if (score <= 35) return '#f87171';
  if (score >= 80) return '#ef4444';
  if (score >= 65) return '#f87171';
  return '#9ca3af';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}
