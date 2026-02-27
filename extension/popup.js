const BACKEND = 'https://cronkite-backend-production.up.railway.app';

const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const errorBox = document.getElementById('errorBox');
const serverDot = document.getElementById('serverDot');
const serverStatus = document.getElementById('serverStatus');
const statusCard = document.querySelector('.status-card');

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

function parseJson3Transcript(data) {
  const events = data?.events || [];
  return events
    .filter(e => e.segs)
    .map(e => e.segs.map(s => (s.utf8 || '').replace(/\n/g, ' ')).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchYouTubeTranscript(tabId, videoId) {
  // Step 1: extract caption track URL from the page's ytInitialPlayerResponse
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: getYouTubeCaptionTrackUrl
  });

  let captionUrl = results[0]?.result;

  // Step 2: if the page gave us a URL, append json3 format
  if (captionUrl) {
    const sep = captionUrl.includes('?') ? '&' : '?';
    captionUrl = `${captionUrl}${sep}fmt=json3`;
  } else {
    // Fallback: YouTube's timedtext API (works for auto-captioned videos)
    captionUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`;
  }

  const resp = await fetch(captionUrl);
  if (!resp.ok) {
    throw new Error(`Caption fetch failed (${resp.status}). This video may have captions disabled.`);
  }

  const data = await resp.json();
  const text = parseJson3Transcript(data);

  if (!text || text.length < 50) {
    throw new Error('No usable captions found for this video. Captions may be disabled or unavailable.');
  }

  return text;
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
    showLoading('Displaying results...');

    await chrome.tabs.sendMessage(tab.id, { action: 'showSidebar', data });
    window.close();

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
    statusCard.innerHTML = `
      <div class="status-icon">▶️</div>
      <div class="status-text">
        YouTube video detected.<br>
        The extension will extract captions <strong>directly in your browser</strong>
        — no server-side YouTube blocking.
      </div>`;
    analyzeBtn.textContent = '▶️ Analyse Video';
  }
}

checkServer();
initUI();
