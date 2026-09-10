// Open the side panel whenever the extension action icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel behavior error:", error));

// Load Aware Auto-Resume: Detect when Salesforce fully loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('force.com') || tab.url.includes('salesforce.com'))) {
    chrome.storage.local.get(['sf_autofill_state'], (result) => {
      const state = result.sf_autofill_state;
      // If loop was running before page reload, auto-resume!
      if (state && state.isLoopRunning && state.currentRowIndex < state.rows.length) {
        // Since Chrome strictly blocks side panels from opening automatically without a manual user click,
        // we open the extension UI as a pinned background tab instead so it's 100% hands-free.
        const extUrl = chrome.runtime.getURL("popup.html");
        chrome.tabs.query({ url: extUrl }, (tabs) => {
          if (tabs.length === 0) {
            chrome.tabs.create({ url: extUrl, active: false, pinned: true }).catch((err) => console.error("Auto-open tab failed:", err));
          }
        });
      }
    });
  }
});

console.log("[SF Email Autofill] Background service worker initialized.");
