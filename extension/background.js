// Background service worker — handles extension lifecycle events
chrome.runtime.onInstalled.addListener(() => {
  console.log('FactCheck extension installed');
});
