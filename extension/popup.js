const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const errorBox = document.getElementById('errorBox');
const serverDot = document.getElementById('serverDot');
const serverStatus = document.getElementById('serverStatus');
const resultsPanel = document.getElementById('resultsPanel');
const scoreCircle  = document.getElementById('scoreCircle');
const scoreVerdict = document.getElementById('scoreVerdict');
const scoreSummary = document.getElementById('scoreSummary');
const claimsHeader = document.getElementById('claimsHeader');
const claimsList   = document.getElementById('claimsList');
const verdictBadge = document.getElementById('verdictBadge');
const biasLabelText = document.getElementById('biasLabelText');
const biasIndicator = document.getElementById('biasIndicator');
const resetBtn = document.getElementById('resetBtn');

function claimClass(verdict) {
  const v = (verdict || '').toLowerCase();
  if (v.includes('true')) return 'cl-true';
  if (v.includes('false') || v.includes('mislead')) return 'cl-false';
  if (v.includes('mixed')) return 'cl-mixed';
  return '';
}

function showResults(data) {
  hideLoading();

  // Credibility score
  scoreCircle.textContent = data.overall_score ?? '—';
  scoreVerdict.textContent = data.verdict || 'Unknown';
  scoreSummary.textContent = data.summary || '';

  // Claims list
  const claims = data.claims || [];
  claimsHeader.textContent = `Claims Analysed — ${claims.length}`;
  claimsList.innerHTML = claims.map(c => `
    <div class="claim-item ${claimClass(c.verdict)}">
      <div class="claim-item-text">${c.claim}</div>
      <div class="claim-item-verdict">${c.verdict}</div>
    </div>`).join('');

  // Verdict badge
  const verdict = data.verdict || 'Unknown';
  verdictBadge.textContent = verdict;
  const vl = verdict.toLowerCase();
  verdictBadge.className = 'verdict-badge ' + (
    vl.includes('true')                             ? 'verdict-true'    :
    vl.includes('false') || vl.includes('mislead')  ? 'verdict-false'   :
    vl.includes('mixed')                            ? 'verdict-mixed'   :
                                                      'verdict-unknown'
  );

  // Bias meter
  const score = typeof data.bias_score === 'number' ? data.bias_score : 50;
  biasIndicator.style.left = score + '%';
  biasLabelText.textContent = data.bias_label || 'Centre';

  document.querySelector('.intro-card').style.display = 'none';
  analyzeBtn.style.display = 'none';
  resultsPanel.style.display = 'block';
}

resetBtn.addEventListener('click', () => {
  resultsPanel.style.display = 'none';
  document.querySelector('.intro-card').style.display = '';
  analyzeBtn.style.display = '';
  errorBox.style.display = 'none';
});

// Check if backend server is running
async function checkServer() {
  try {
    const res = await fetch('https://cronkite-backend-production.up.railway.app/health', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      serverDot.classList.remove('offline');
      serverStatus.textContent = 'Server online';
    } else {
      throw new Error();
    }
  } catch {
    serverDot.classList.add('offline');
    serverStatus.textContent = 'Server offline — start backend first';
    analyzeBtn.disabled = true;
  }
}

function showLoading(text) {
  loading.style.display = 'block';
  loadingText.textContent = text;
  analyzeBtn.disabled = true;
  errorBox.style.display = 'none';
}

function hideLoading() {
  loading.style.display = 'none';
  analyzeBtn.disabled = false;
}

function showError(msg) {
  errorBox.style.display = 'block';
  errorBox.textContent = '⚠️ ' + msg;
  hideLoading();
}

analyzeBtn.addEventListener('click', async () => {
  errorBox.style.display = 'none';

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  showLoading('Extracting article text...');

  // Inject content script to extract text and show sidebar
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractArticleText
    });

    const articleText = results[0].result;

    if (!articleText || articleText.length < 100) {
      showError('Could not find enough article text on this page. Try navigating to a news article.');
      return;
    }

    showLoading('Sending to fact-checker (this may take 20–40s)...');

    // Call our backend
    const response = await fetch('https://cronkite-backend-production.up.railway.app/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: articleText, url: tab.url })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || 'Server error');
    }

    const data = await response.json();

    // Send results to content script to show sidebar
    chrome.tabs.sendMessage(tab.id, { action: 'showSidebar', data }).catch(() => {});

    // Show results in popup
    showResults(data);

  } catch (err) {
    if (err.message.includes('fetch')) {
      showError('Cannot connect to backend. Make sure you ran: uvicorn main:app --reload');
    } else {
      showError(err.message);
    }
  }
});

// Extracts article text from the page — runs inside the tab
function extractArticleText() {
  // Try common article selectors first
  const selectors = [
    'article',
    '[role="main"]',
    '.article-body',
    '.story-body',
    '.post-content',
    '.entry-content',
    '.article-content',
    'main'
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText.trim();
      if (text.length > 200) return text;
    }
  }

  // Fallback: get all paragraph text
  const paragraphs = Array.from(document.querySelectorAll('p'));
  return paragraphs.map(p => p.innerText.trim()).filter(t => t.length > 40).join('\n\n');
}

checkServer();
