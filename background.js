// Open the side panel whenever the extension action icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel behavior error:", error));

// Load Aware Auto-Resume: Detect when Salesforce fully loads
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('force.com') || tab.url.includes('salesforce.com'))) {
    chrome.storage.local.get(['sf_autofill_state'], (result) => {
      const state = result.sf_autofill_state;
      // If loop was running before page reload, auto-open the side panel to resume
      if (state && state.isLoopRunning && state.currentRowIndex < state.rows.length) {
        chrome.sidePanel.open({ tabId: tabId }).catch((err) => console.error("Side panel auto-open failed:", err));
      }
    });
  }
});

console.log("[SF Email Autofill] Background service worker initialized.");
