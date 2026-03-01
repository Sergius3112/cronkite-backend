const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const errorBox = document.getElementById('errorBox');
const serverDot = document.getElementById('serverDot');
const serverStatus = document.getElementById('serverStatus');

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

    showLoading('Displaying results...');

    // Send results to content script to show sidebar
    await chrome.tabs.sendMessage(tab.id, {
      action: 'showSidebar',
      data: data
    });

    // Close popup
    window.close();

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
