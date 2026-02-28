const BACKEND = 'https://cronkite-backend-production.up.railway.app';

const analyzeBtn    = document.getElementById('analyzeBtn');
const loading       = document.getElementById('loading');
const loadingText   = document.getElementById('loadingText');
const errorBox      = document.getElementById('errorBox');
const serverDot     = document.getElementById('serverDot');
const serverStatus  = document.getElementById('serverStatus');
const statusCard    = document.getElementById('statusCard');
const statusText    = document.getElementById('statusText');
const resultsPanel  = document.getElementById('resultsPanel');
const verdictBadge  = document.getElementById('verdictBadge');
const accuracyScore = document.getElementById('accuracyScore');
const biasScoreVal  = document.getElementById('biasScoreVal');
const biasIndicator = document.getElementById('biasIndicator');
const biasLabelText = document.getElementById('biasLabelText');
const resultsSummary= document.getElementById('resultsSummary');
const resetBtn      = document.getElementById('resetBtn');

// ── Helpers ───────────────────────────────────────────────────────────────────

function isYouTubeUrl(url) {
  return /youtube\.com\/watch|youtu\.be\//.test(url);
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function checkServer() {
  try {
    const res = await fetch(`${BACKEND}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      serverDot.classList.remove('offline');
      serverStatus.textContent = 'Server online';
    } else {
      throw new Error();
    }
  } catch {
    serverDot.classList.add('offline');
    serverStatus.textContent = 'Server offline';
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

// ── Results panel ─────────────────────────────────────────────────────────────

const BIAS_LABELS = [
  [10,  'Far Left'],
  [30,  'Left'],
  [45,  'Centre-Left'],
  [55,  'Centre'],
  [70,  'Centre-Right'],
  [85,  'Right'],
  [100, 'Far Right'],
];

function biasLabel(score) {
  for (const [max, label] of BIAS_LABELS) {
    if (score <= max) return label;
  }
  return 'Far Right';
}

function showResults(data) {
  hideLoading();

  const verdict = data.verdict || 'Unknown';
  verdictBadge.textContent = verdict;
  const vl = verdict.toLowerCase();
  verdictBadge.className = 'verdict-badge ' + (
    vl.includes('true')                          ? 'verdict-true'  :
    vl.includes('false') || vl.includes('mislead') ? 'verdict-false' :
    vl.includes('mixed')                         ? 'verdict-mixed'  :
                                                   'verdict-unknown'
  );

  accuracyScore.textContent = data.overall_score ?? '–';
  biasScoreVal.textContent  = data.bias_score    ?? '–';

  const bScore = typeof data.bias_score === 'number' ? data.bias_score : 50;
  biasIndicator.style.left  = bScore + '%';
  biasLabelText.textContent = data.bias_label || biasLabel(bScore);

  const summary = data.summary || '';
  resultsSummary.textContent = summary.length > 200 ? summary.slice(0, 200) + '…' : summary;

  statusCard.style.display   = 'none';
  analyzeBtn.style.display   = 'none';
  resultsPanel.style.display = 'block';
}

resetBtn.addEventListener('click', () => {
  resultsPanel.style.display = 'none';
  statusCard.style.display   = '';
  analyzeBtn.style.display   = '';
  errorBox.style.display     = 'none';
});

// ── YouTube transcript extraction (runs in browser, bypasses server blocks) ───

// Executed inside the YouTube tab — reads ytInitialPlayerResponse off the page
function getYouTubeCaptionTrackUrl() {
  try {
    const tracks =
      window.ytInitialPlayerResponse
        ?.captions
        ?.playerCaptionsTracklistRenderer
        ?.captionTracks;
    if (!tracks || tracks.length === 0) return null;
    // Prefer manual English, then auto-generated English, then first available
    const pick =
      tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr') ||
      tracks.find(t => t.languageCode === 'en') ||
      tracks.find(t => t.languageCode?.startsWith('en')) ||
      tracks[0];
    return pick?.baseUrl || null;
  } catch {
    return null;
  }
}

// Parses YouTube timedtext XML into plain text.
// DOMParser handles HTML entity decoding (&amp; &#39; etc.) automatically.
function parseXmlTranscript(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  return Array.from(doc.querySelectorAll('text'))
    .map(el => el.textContent.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchYouTubeTranscript(tabId, videoId) {
  // Step 1: try to get the exact caption track URL from the page
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: getYouTubeCaptionTrackUrl
  });

  const pageUrl = results[0]?.result;

  if (pageUrl) {
    // Use the page-provided URL with XML format
    const sep = pageUrl.includes('?') ? '&' : '?';
    try {
      const resp = await fetch(`${pageUrl}${sep}fmt=xml`);
      if (resp.ok) {
        const text = parseXmlTranscript(await resp.text());
        if (text && text.length >= 50) return text;
      }
    } catch { /* fall through to timedtext fallback */ }
  }

  // Step 2: timedtext API with multiple language/kind variants
  const base = `https://www.youtube.com/api/timedtext?v=${videoId}`;
  const attempts = [
    `${base}&lang=en`,
    `${base}&lang=en-GB`,
    `${base}&kind=asr&lang=en`,
    `${base}&kind=asr&lang=en-GB`,
  ];

  for (const url of attempts) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const text = parseXmlTranscript(await resp.text());
      if (text && text.length >= 50) return text;
    } catch {
      continue;
    }
  }

  throw new Error('No captions found for this video. Captions may be disabled or unavailable.');
}

// ── Main click handler ────────────────────────────────────────────────────────

analyzeBtn.addEventListener('click', async () => {
  errorBox.style.display = 'none';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    let contentText;

    if (isYouTubeUrl(tab.url)) {
      // ── YouTube path: extract transcript in-browser ────────────────────────
      const videoId = extractVideoId(tab.url);
      if (!videoId) {
        showError('Could not parse a YouTube video ID from this URL.');
        return;
      }

      showLoading('Extracting YouTube captions in browser...');
      contentText = await fetchYouTubeTranscript(tab.id, videoId);
      showLoading(`Got transcript (${contentText.length} chars). Sending to fact-checker...`);

    } else {
      // ── Article path: extract page text ───────────────────────────────────
      showLoading('Extracting article text...');

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractArticleText
      });

      contentText = results[0].result;

      if (!contentText || contentText.length < 100) {
        showError('Could not find enough article text on this page. Try navigating to a news article.');
        return;
      }

      showLoading('Sending to fact-checker (this may take 20–40s)...');
    }

    // ── Send to backend ────────────────────────────────────────────────────
    const response = await fetch(`${BACKEND}/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: contentText, url: tab.url })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${response.status}`);
    }

    const data = await response.json();

    chrome.tabs.sendMessage(tab.id, { action: 'showSidebar', data }).catch(() => {});
    showResults(data);

  } catch (err) {
    if (err.message.toLowerCase().includes('fetch') || err.message.includes('connect')) {
      showError('Cannot connect to backend. Check that the server is running.');
    } else {
      showError(err.message);
    }
  }
});

// ── Article text extractor — runs inside the tab ──────────────────────────────

function extractArticleText() {
  const selectors = [
    'article', '[role="main"]', '.article-body', '.story-body',
    '.post-content', '.entry-content', '.article-content', 'main'
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText.trim();
      if (text.length > 200) return text;
    }
  }
  const paragraphs = Array.from(document.querySelectorAll('p'));
  return paragraphs.map(p => p.innerText.trim()).filter(t => t.length > 40).join('\n\n');
}

// ── Update UI based on current tab ───────────────────────────────────────────

async function initUI() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (isYouTubeUrl(tab.url)) {
    statusCard.classList.add('yt-card');
    document.querySelector('.status-label').textContent = 'YouTube Detected';
    statusText.innerHTML =
      'Click below to extract captions from this video and fact-check its claims.';
    analyzeBtn.textContent = 'Analyse YouTube Video';
  }
}

checkServer();
initUI();
