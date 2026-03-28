const analyzeBtn = document.getElementById('analyzeBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const errorBox = document.getElementById('errorBox');
const serverDot = document.getElementById('serverDot');
const serverStatus = document.getElementById('serverStatus');
const mainContent = document.getElementById('mainContent');
const loginPrompt = document.getElementById('loginPrompt');

const API_BASE = 'https://cronkite.education';
const STORAGE_KEY = 'sb-givyodepnqelhhmtmypk-auth-token';

// Retrieve Supabase access token from chrome.storage.local.
// The content script syncs it there from localStorage when the user visits the Cronkite app.
async function getAuthToken() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const authData = result[STORAGE_KEY];
  if (!authData) return null;
  // Supabase v2 stores the session object directly: { access_token, refresh_token, ... }
  return authData.access_token || authData?.currentSession?.access_token || null;
}

async function checkServer() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
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

function showLoginState() {
  mainContent.style.display = 'none';
  loginPrompt.style.display = 'block';
  serverDot.classList.remove('offline');
  serverStatus.textContent = 'Not signed in';
}

function showMainState() {
  mainContent.style.display = 'block';
  loginPrompt.style.display = 'none';
}

async function init() {
  const token = await getAuthToken();
  if (!token) {
    showLoginState();
    return;
  }
  showMainState();
  checkServer();
}

analyzeBtn.addEventListener('click', async () => {
  errorBox.style.display = 'none';

  const token = await getAuthToken();
  if (!token) {
    showLoginState();
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  showLoading('Sending to Cronkite…');

  try {
    const response = await fetch(`${API_BASE}/api/analyse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url: tab.url }),
    });

    if (response.status === 401) {
      // Token expired or invalid — clear storage and show login
      await chrome.storage.local.remove(STORAGE_KEY);
      showLoginState();
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(err.detail || 'Analysis failed');
    }

    const data = await response.json();

    showLoading('Displaying results…');

    await chrome.tabs.sendMessage(tab.id, {
      action: 'showSidebar',
      data: data,
    });

    window.close();

  } catch (err) {
    showError(err.message || 'Analysis failed');
  }
});

document.getElementById('chatBtn')?.addEventListener('click', async () => {
  const token = await getAuthToken();
  if (!token) { showLoginState(); return; }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.sendMessage(tab.id, { action: 'showChatSidebar', url: tab.url });
  window.close();
});

init();
