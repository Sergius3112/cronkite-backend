// Switch toolbar icon based on light/dark mode
function updateIcon() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const folder = isDark ? 'icons' : 'icons_dark';
  chrome.action.setIcon({
    path: {
      "16": `${folder}/icon16.png`,
      "48": `${folder}/icon48.png`,
      "128": `${folder}/icon128.png`
    }
  });
}

chrome.runtime.onInstalled.addListener(updateIcon);
chrome.runtime.onStartup.addListener(updateIcon);
