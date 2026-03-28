// Sync Supabase auth token from Cronkite app pages to chrome.storage.local.
// This runs on every page load — when the user visits the Cronkite app while logged in,
// their session token is copied to chrome.storage so the popup can read it.
(function syncAuthToken() {
  const CRONKITE_HOST = 'cronkite.education';
  if (window.location.hostname !== CRONKITE_HOST) return;
  const KEY = 'sb-givyodepnqelhhmtmypk-auth-token';
  const raw = localStorage.getItem(KEY);
  if (!raw) return;
  try {
    chrome.storage.local.set({ [KEY]: JSON.parse(raw) });
  } catch {}
})();

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'showSidebar') showSidebar(message.data);
  if (message.action === 'showChatSidebar') showChatSidebar(message.url);
});

function showSidebar(data) {
  const existing = document.getElementById('factcheck-sidebar');
  if (existing) existing.remove();

  const sidebar = document.createElement('div');
  sidebar.id = 'factcheck-sidebar';

  // ── Schema fields from analyse_url_internal() ──────────────────────────────
  const score = data.credibility_score ?? data.overall_credibility_score ?? 50;
  const scoreColor = getScoreColor(score);
  const verdictLabel = getVerdictLabel(score);

  // bias_direction: -100 (far left) → +100 (far right); convert to 0–100 for bar position
  const biasDirection = data.bias_direction ?? 0;
  const biasPosition = (biasDirection + 100) / 2;
  const biasColor = getBiasColor(biasDirection);
  const biasLabel = getBiasLabel(biasDirection);

  const wordAnalysis = data.word_analysis || [];
  const persuasionTechniques = data.persuasion_techniques || [];
  const keyClaims = data.key_claims || [];
  const creatorProfile = data.creator_profile || {};
  const sourceProfile = data.source_profile || {};

  const logoUrl = chrome.runtime.getURL('icons_white/icon128.png');

  sidebar.innerHTML = `
    <!-- Fixed top bar -->
    <div class="fc-header-top">
      <img class="fc-logo" src="${logoUrl}" alt="Cronkite">
      <button class="fc-close" id="fc-close-btn">✕</button>
    </div>

    <!-- Scrollable body -->
    <div class="fc-scrollable">

      <!-- Credibility score -->
      <div class="fc-score-card">
        <div class="fc-score-circle" style="border-color:${scoreColor};color:${scoreColor}">${score}</div>
        <div class="fc-score-info">
          <div class="fc-score-label">Credibility Score</div>
          <div class="fc-score-verdict">${verdictLabel}</div>
          ${data.source ? `<div style="font-size:10px;color:#7d6e56;margin-top:1px;margin-bottom:3px">${escapeHtml(data.source)}</div>` : ''}
          <div class="fc-score-summary">${escapeHtml(data.summary || '')}</div>
        </div>
      </div>

      <!-- Bias: uses bias_direction (-100→+100) and bias_reasoning -->
      <div class="fc-bias-card">
        <div class="fc-bias-header">
          <span class="fc-score-label">Political Bias</span>
          <span class="fc-bias-label" style="color:${biasColor}">${biasLabel}</span>
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
        ${data.bias_reasoning ? `<div class="fc-bias-summary">${escapeHtml(data.bias_reasoning)}</div>` : ''}
      </div>

      <!-- Goal / Technique / Conclusion -->
      ${(data.goal || data.technique || data.conclusion) ? `
        <div class="fc-bias-card" style="margin-top:0">
          ${data.goal ? `
            <div class="fc-score-label" style="margin-bottom:4px">Communicative Goal</div>
            <div style="font-size:12px;color:#0a0a0a;line-height:1.5;margin-bottom:${(data.technique || data.conclusion) ? '12' : '0'}px">${escapeHtml(data.goal)}</div>
          ` : ''}
          ${data.technique ? `
            <div class="fc-score-label" style="margin-bottom:4px">Primary Technique</div>
            <div style="font-size:12px;color:#4a3f2f;line-height:1.5;margin-bottom:${data.conclusion ? '12' : '0'}px">${escapeHtml(data.technique)}</div>
          ` : ''}
          ${data.conclusion ? `
            <div class="fc-score-label" style="margin-bottom:4px">Critical Conclusion</div>
            <div style="font-size:12px;color:#4a3f2f;line-height:1.5">${escapeHtml(data.conclusion)}</div>
          ` : ''}
        </div>
      ` : ''}

      <!-- word_analysis[{ word, flag_type, explanation }] replaces old language_flags -->
      ${wordAnalysis.length > 0 ? `
        <div class="fc-flags-card">
          <div class="fc-flags-title">
            <span class="fc-score-label">Word Analysis</span>
            <span class="fc-flags-count">${wordAnalysis.length}</span>
          </div>
          ${wordAnalysis.map(w => `
            <div class="fc-flag-item">
              <div class="fc-flag-phrase">
                "${escapeHtml(w.word)}"
                <span style="font-size:9px;font-style:normal;text-transform:uppercase;letter-spacing:1px;opacity:0.65;margin-left:4px">${escapeHtml(w.flag_type || '')}</span>
              </div>
              <div class="fc-flag-issue">${escapeHtml(w.explanation || '')}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- persuasion_techniques[{ technique, example, explanation }] -->
      ${persuasionTechniques.length > 0 ? `
        <div class="fc-bias-card" style="margin-top:0">
          <div class="fc-score-label" style="margin-bottom:10px">Persuasion Techniques</div>
          ${persuasionTechniques.map((pt, i) => `
            <div style="margin-bottom:${i < persuasionTechniques.length - 1 ? '12' : '0'}px;${i < persuasionTechniques.length - 1 ? 'padding-bottom:12px;border-bottom:1px dashed #c5b89a' : ''}">
              <div style="font-size:11px;font-weight:600;color:#c8102e;margin-bottom:3px">${escapeHtml(pt.technique || '')}</div>
              ${pt.example ? `<div style="font-size:11px;font-style:italic;color:#4a3f2f;margin-bottom:3px;line-height:1.5">"${escapeHtml(pt.example)}"</div>` : ''}
              ${pt.explanation ? `<div style="font-size:11px;color:#7d6e56;line-height:1.5">${escapeHtml(pt.explanation)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- source_profile and creator_profile -->
      ${(sourceProfile.name || creatorProfile.name) ? `
        <div class="fc-bias-card" style="margin-top:0">
          ${sourceProfile.name ? `
            <div class="fc-score-label" style="margin-bottom:5px">Source: ${escapeHtml(sourceProfile.name)}</div>
            ${sourceProfile.editorial_stance ? `<div style="font-size:11px;color:#4a3f2f;margin-bottom:3px;line-height:1.5"><span style="color:#7d6e56">Stance:</span> ${escapeHtml(sourceProfile.editorial_stance)}</div>` : ''}
            ${sourceProfile.ownership ? `<div style="font-size:11px;color:#4a3f2f;margin-bottom:3px;line-height:1.5"><span style="color:#7d6e56">Ownership:</span> ${escapeHtml(sourceProfile.ownership)}</div>` : ''}
            ${sourceProfile.credibility_impact ? `<div style="font-size:11px;color:#7d6e56;line-height:1.5;margin-bottom:${creatorProfile.name ? '12' : '0'}px">${escapeHtml(sourceProfile.credibility_impact)}</div>` : ''}
          ` : ''}
          ${creatorProfile.name ? `
            <div class="fc-score-label" style="margin-bottom:5px">Creator: ${escapeHtml(creatorProfile.name)}</div>
            ${creatorProfile.political_leaning ? `<div style="font-size:11px;color:#4a3f2f;margin-bottom:3px"><span style="color:#7d6e56">Leaning:</span> ${escapeHtml(creatorProfile.political_leaning)}</div>` : ''}
            ${creatorProfile.credibility_impact ? `<div style="font-size:11px;color:#7d6e56;line-height:1.5">${escapeHtml(creatorProfile.credibility_impact)}</div>` : ''}
          ` : ''}
        </div>
      ` : ''}

      <!-- key_claims[{ claim, verdict, evidence, source }] replaces old claims[] -->
      ${keyClaims.length > 0 ? `
        <div class="fc-claims-header">Key Claims — ${keyClaims.length}</div>
        <div class="fc-claims">
          ${keyClaims.map(claim => renderClaim(claim)).join('')}
        </div>
      ` : ''}

      <div class="fc-footer">Cronkite · AI Media Literacy Analysis</div>

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

// Renders one item from key_claims[{ claim, verdict, evidence, source }]
function renderClaim(claim) {
  const color = getVerdictColor(claim.verdict);
  return `
    <div class="fc-claim">
      <div class="fc-claim-header">
        <div class="fc-claim-indicator" style="background:${color}"></div>
        <span class="fc-claim-text">${escapeHtml(claim.claim || '')}</span>
        <span class="fc-claim-score" style="color:${color};font-size:9px;text-transform:uppercase;letter-spacing:0.5px;flex-shrink:0">${escapeHtml(claim.verdict || '')}</span>
      </div>
      <div class="fc-claim-detail">
        <div class="fc-verdict-badge" style="background:${color}18;color:${color};border-color:${color}35">
          ${escapeHtml(claim.verdict || '')}
        </div>
        ${claim.evidence ? `<p class="fc-explanation">${escapeHtml(claim.evidence)}</p>` : ''}
        ${claim.source ? `
          <div class="fc-sources">
            <strong>Source</strong>
            <ul><li>${escapeHtml(claim.source)}</li></ul>
          </div>
        ` : ''}
      </div>
    </div>`;
}

// credibility_score (0-100)
function getScoreColor(score) {
  if (score >= 75) return '#4ade80';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

// Derive a label from credibility_score since there is no top-level verdict field
function getVerdictLabel(score) {
  if (score >= 75) return 'Credible';
  if (score >= 50) return 'Use with Caution';
  if (score >= 25) return 'Low Credibility';
  return 'Unreliable';
}

// bias_direction: -100 (far left) → +100 (far right)
function getBiasColor(direction) {
  const abs = Math.abs(direction);
  if (abs >= 60) return '#c8102e';
  if (abs >= 30) return '#f59e0b';
  return '#9ca3af';
}

function getBiasLabel(direction) {
  if (direction <= -60) return 'Strong Left';
  if (direction <= -20) return 'Left-leaning';
  if (direction >= 60) return 'Strong Right';
  if (direction >= 20) return 'Right-leaning';
  return 'Centre';
}

// key_claims verdict: verified | unverified | misleading | false
function getVerdictColor(verdict) {
  switch (verdict) {
    case 'verified':   return '#4ade80';
    case 'unverified': return '#f59e0b';
    case 'misleading': return '#f97316';
    case 'false':      return '#ef4444';
    default:           return '#9ca3af';
  }
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

function showChatSidebar(url) {
  const existing = document.getElementById('factcheck-sidebar');
  if (existing) existing.remove();

  const sidebar = document.createElement('div');
  sidebar.id = 'factcheck-sidebar';

  const logoUrl = chrome.runtime.getURL('icons_white/icon128.png');
  const articleContent = document.body.innerText.substring(0, 3000);
  let chatHistory = [];

  sidebar.innerHTML = `
    <div class="fc-header-top">
      <img class="fc-logo" src="${logoUrl}" alt="Cronkite">
      <span style="font-size:11px;color:#C8B89A;flex:1;margin-left:8px">Ask Cronkite</span>
      <button class="fc-close" id="fc-close-btn">✕</button>
    </div>
    <div class="fc-scrollable" id="fc-chat-messages" style="display:flex;flex-direction:column;gap:8px;padding:12px;">
      <div style="background:rgba(247,243,236,0.1);border-radius:10px;padding:10px 12px;font-size:12px;color:#C8B89A;line-height:1.5">
        Hi! I'm Cronkite. I've read this article. Ask me anything about its bias, claims, or persuasion techniques.
      </div>
    </div>
    <div style="padding:10px;border-top:1px solid rgba(247,243,236,0.1);display:flex;gap:6px;">
      <input id="fc-chat-input" placeholder="Ask about this article…"
        style="flex:1;background:rgba(247,243,236,0.08);border:1px solid rgba(247,243,236,0.15);border-radius:7px;padding:8px 10px;font-size:12px;color:#F7F3EC;font-family:'DM Sans',sans-serif;outline:none;" />
      <button id="fc-send-btn"
        style="background:rgb(196,30,58);color:#fff;border:none;border-radius:7px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;">
        Send
      </button>
    </div>
  `;

  document.body.appendChild(sidebar);
  document.getElementById('fc-close-btn').addEventListener('click', () => {
    sidebar.remove();
    document.body.style.marginRight = '';
  });
  document.body.style.marginRight = '390px';

  const input = document.getElementById('fc-chat-input');
  const sendBtn = document.getElementById('fc-send-btn');
  const messages = document.getElementById('fc-chat-messages');

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    // Add student message
    const studentMsg = document.createElement('div');
    studentMsg.style.cssText = 'background:rgb(196,30,58);border-radius:10px;padding:8px 12px;font-size:12px;color:#fff;line-height:1.5;align-self:flex-end;max-width:85%;margin-left:15%';
    studentMsg.textContent = text;
    messages.appendChild(studentMsg);
    messages.scrollTop = messages.scrollHeight;

    // Loading indicator
    const loading = document.createElement('div');
    loading.style.cssText = 'background:rgba(247,243,236,0.1);border-radius:10px;padding:8px 12px;font-size:12px;color:#9E9488;line-height:1.5;max-width:85%';
    loading.textContent = 'Cronkite is thinking…';
    messages.appendChild(loading);
    messages.scrollTop = messages.scrollHeight;

    try {
      const result = await chrome.storage.local.get('sb-givyodepnqelhhmtmypk-auth-token');
      const authData = result['sb-givyodepnqelhhmtmypk-auth-token'];
      const token = authData?.access_token || authData?.currentSession?.access_token || '';

      const resp = await fetch('https://cronkite.education/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ url, article_content: articleContent, message: text, history: chatHistory })
      });
      const data = await resp.json();
      const reply = data.reply || 'Sorry, I could not process that.';

      chatHistory.push({ role: 'user', content: text });
      chatHistory.push({ role: 'assistant', content: reply });

      loading.style.color = '#C8B89A';
      loading.textContent = reply;
    } catch {
      loading.style.color = 'rgb(196,30,58)';
      loading.textContent = 'Error — please try again.';
    }
    messages.scrollTop = messages.scrollHeight;
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
}
