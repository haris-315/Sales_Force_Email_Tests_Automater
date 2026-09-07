// Open the side panel whenever the extension action icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Side panel behavior error:", error));

console.log("[SF Email Autofill] Background service worker initialized.");
