# Salesforce Email CSV Autofill Chrome Extension (Manifest V3)

A Chrome extension designed to parse CSV contact lists, map columns dynamically to Salesforce Lightning Email Composer fields (`To`, `Subject`, `Body`), and iterate through rows with state tracking.

---

## 🚀 Features

- **Dynamic Column Mapping**: Upload any CSV and map your custom column headers to `Receiver Email`, `Email Subject`, and `Email Content`.
- **State Persistence (`chrome.storage.local`)**: Progress, uploaded rows, and column mappings are saved automatically—closing the popup never loses your spot.
- **Salesforce Lightning DOM Engine**:
  - Automatically cleans up existing recipient pills.
  - Injects new receiver emails and commits them as pills via synthetic `Enter` keyboard events.
  - Populates subject lines.
  - Formats and injects body text into rich text editors (`div[contenteditable]` and CKEditor `iframe`).
  - Supports one-click **Fill Current** or automated **Fill & Send**.
- **Progress Tracking & Controls**:
  - Live progress bar with row preview.
  - Previous / Skip / Reset controls.

---

## 🛠️ How to Install in Chrome

1. Open Chrome and go to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the directory:
   ```
   /home/harry/Documents/dev_playground/batteries/flutter/salesforce-email-autofill-extension
   ```

---

## 📖 How to Use

1. Open a lead or contact record in **Salesforce Lightning** and open the **Email Composer** modal/dock.
2. Click the **Salesforce Email CSV Autofill** extension icon in your browser toolbar.
3. Upload your CSV file (or use the included `sample_contacts.csv`).
4. Confirm column mappings for `To`, `Subject`, and `Content`.
5. Click **📝 Fill Current** to inspect the fields populated in Salesforce, or **🚀 Fill & Send** to automate sending and advancing through rows.
