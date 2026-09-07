/**
 * Salesforce Email CSV Autofill - Controller
 * Supports Field Clearing & Nested Salesforce CKEditor iFrames
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const statusBanner = document.getElementById('statusBanner');
  const stepUpload = document.getElementById('stepUpload');
  const stepMapping = document.getElementById('stepMapping');
  const stepDashboard = document.getElementById('stepDashboard');

  const tabBtnUpload = document.getElementById('tabBtnUpload');
  const tabBtnPaste = document.getElementById('tabBtnPaste');
  const uploadFileSection = document.getElementById('uploadFileSection');
  const pasteTextSection = document.getElementById('pasteTextSection');

  const csvFileInput = document.getElementById('csvFileInput');
  const uploadFilename = document.getElementById('uploadFilename');
  const dropZone = document.getElementById('dropZone');
  const csvTextInput = document.getElementById('csvTextInput');
  const btnParsePastedCSV = document.getElementById('btnParsePastedCSV');
  const btnBackToUpload = document.getElementById('btnBackToUpload');

  const colReceiverEmail = document.getElementById('colReceiverEmail');
  const colEmailSubject = document.getElementById('colEmailSubject');
  const colEmailContent = document.getElementById('colEmailContent');
  const btnConfirmMapping = document.getElementById('btnConfirmMapping');

  const rowCounterBadge = document.getElementById('rowCounterBadge');
  const progressBarFill = document.getElementById('progressBarFill');
  const prevTo = document.getElementById('prevTo');
  const prevSubject = document.getElementById('prevSubject');
  const prevContent = document.getElementById('prevContent');

  const btnFillOnly = document.getElementById('btnFillOnly');
  const btnFillAndSend = document.getElementById('btnFillAndSend');
  const btnPrevRow = document.getElementById('btnPrevRow');
  const btnSkipRow = document.getElementById('btnSkipRow');
  const btnResetProgress = document.getElementById('btnResetProgress');
  const btnChangeMapping = document.getElementById('btnChangeMapping');

  // Application State
  let state = {
    fileName: '',
    headers: [],
    rows: [],
    mapping: {
      receiverEmail: '',
      emailSubject: '',
      emailContent: ''
    },
    currentRowIndex: 0,
    processedIndices: []
  };

  // Load State from chrome.storage.local
  async function loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sf_autofill_state'], (result) => {
        if (result && result.sf_autofill_state) {
          state = { ...state, ...result.sf_autofill_state };
        }
        resolve();
      });
    });
  }

  // Save State to chrome.storage.local
  async function saveState() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ sf_autofill_state: state }, () => {
        resolve();
      });
    });
  }

  // Banner Notification
  function showBanner(message, type = 'info', timeoutMs = 4000) {
    statusBanner.textContent = message;
    statusBanner.className = `status-banner ${type}`;
    statusBanner.classList.remove('hidden');

    if (timeoutMs > 0) {
      setTimeout(() => {
        statusBanner.classList.add('hidden');
      }, timeoutMs);
    }
  }

  // RFC 4180 Compliant CSV Parser
  function parseCSV(text) {
    const lines = [];
    let row = [];
    let cell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          cell += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        row.push(cell.trim());
        cell = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(cell.trim());
        if (row.some(c => c.length > 0)) {
          lines.push(row);
        }
        row = [];
        cell = '';
      } else {
        cell += char;
      }
    }

    if (cell.length > 0 || row.length > 0) {
      row.push(cell.trim());
      if (row.some(c => c.length > 0)) {
        lines.push(row);
      }
    }

    if (lines.length < 2) {
      throw new Error("CSV must contain at least a header row and one data row.");
    }

    const headers = lines[0];
    const rows = lines.slice(1).map((r) => {
      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = r[idx] || '';
      });
      return rowObj;
    });

    return { headers, rows };
  }

  // Process Parsed Data
  async function processParsedData(fileName, parsed) {
    state.fileName = fileName;
    state.headers = parsed.headers;
    state.rows = parsed.rows;
    state.currentRowIndex = 0;
    state.processedIndices = [];
    state.mapping = { receiverEmail: '', emailSubject: '', emailContent: '' };

    uploadFilename.textContent = `${fileName} (${state.rows.length} rows loaded)`;
    populateMappingOptions();
    await saveState();

    showBanner(`Successfully loaded ${state.rows.length} rows!`, "success");
    renderUI();
  }

  // Handle CSV File Upload
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCSV(text);
        await processParsedData(file.name, parsed);
      } catch (err) {
        showBanner(`CSV Error: ${err.message}`, "error");
      }
    };
    reader.readAsText(file);
  }

  // Populate Mapping Dropdowns with Smart Column Guessing
  function populateMappingOptions() {
    const selects = [colReceiverEmail, colEmailSubject, colEmailContent];

    selects.forEach((sel) => {
      sel.innerHTML = '<option value="">-- Select Column --</option>';
      state.headers.forEach((h) => {
        const opt = document.createElement('option');
        opt.value = h;
        opt.textContent = h;
        sel.appendChild(opt);
      });
    });

    state.headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (!state.mapping.receiverEmail && (lower.includes('email') || lower.includes('receiver') || lower.includes('to'))) {
        colReceiverEmail.value = h;
        state.mapping.receiverEmail = h;
      } else if (!state.mapping.emailSubject && (lower.includes('subject') || lower.includes('title') || lower.includes('topic'))) {
        colEmailSubject.value = h;
        state.mapping.emailSubject = h;
      } else if (!state.mapping.emailContent && (lower.includes('body') || lower.includes('content') || lower.includes('message') || lower.includes('template'))) {
        colEmailContent.value = h;
        state.mapping.emailContent = h;
      }
    });

    if (state.mapping.receiverEmail) colReceiverEmail.value = state.mapping.receiverEmail;
    if (state.mapping.emailSubject) colEmailSubject.value = state.mapping.emailSubject;
    if (state.mapping.emailContent) colEmailContent.value = state.mapping.emailContent;
  }

  // IN-PAGE SCRIPT RUNNER (Executed across all nested frames in MAIN world)
  function inPageRunner(data) {
    return new Promise(async (resolve) => {
      try {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        let actionsDone = { receiver: false, subject: false, body: false, send: false };

        const toContainer =
          document.querySelector('div[role="dialog"][aria-label="Email"]') ||
          document.querySelector('.emailuiComposer') ||
          document.body;

        // ==========================================
        // 1. CLEAR & FILL: RECEIVER (TO) FIELD
        // ==========================================
        const toInput =
          toContainer.querySelector('ul[aria-label="To"] input[role="combobox"]') ||
          toContainer.querySelector('.emailuiBaseAddressContainer input.uiPillContainerAutoComplete') ||
          toContainer.querySelector('.emailuiPillContainer input') ||
          toContainer.querySelector('input[aria-label="To"]');

        // Always clear existing recipient pills first
        const existingPills = toContainer.querySelectorAll(
          'ul[aria-label="To"] .slds-pill__remove, ul[aria-label="To"] [data-action="delete"]'
        );
        existingPills.forEach((btn) => { try { btn.click(); } catch (e) {} });

        if (toInput) {
          toInput.value = '';
          toInput.dispatchEvent(new Event('input', { bubbles: true }));
          toInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (existingPills.length > 0) {
          await sleep(120);
        }

        // Insert new receiver email if provided
        if (data.receiverEmail && toInput) {
          toInput.focus();
          await sleep(30);
          document.execCommand('insertText', false, data.receiverEmail);
          if (toInput.value !== data.receiverEmail) {
            toInput.value = data.receiverEmail;
          }
          toInput.dispatchEvent(new Event('input', { bubbles: true }));
          toInput.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(30);

          toInput.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
          }));
          toInput.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
          }));
          actionsDone.receiver = true;
        }

        // ==========================================
        // 2. CLEAR & FILL: SUBJECT FIELD
        // ==========================================
        const subjectInput =
          document.querySelector('input[placeholder="Enter Subject..."]') ||
          document.querySelector('input[aria-label="Subject"]') ||
          document.querySelector('lightning-input[data-field-name="Subject"] input') ||
          document.querySelector('.slds-form-element input.slds-input[placeholder*="Subject"]');

        if (subjectInput) {
          // Clear first
          subjectInput.value = '';
          subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
          subjectInput.dispatchEvent(new Event('change', { bubbles: true }));

          if (data.emailSubject !== undefined && data.emailSubject !== null) {
            subjectInput.focus();
            await sleep(30);
            subjectInput.value = data.emailSubject;
            subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
            subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
            actionsDone.subject = true;
          }
        }

        // ==========================================
        // 3. CLEAR & FILL: BODY FIELD (CKEditor)
        // ==========================================
        const formattedHtml = (data.emailContent && (data.emailContent.includes('<p>') || data.emailContent.includes('<br>')))
          ? data.emailContent
          : `<p>${(data.emailContent || '').replace(/\n/g, '</p><p>')}</p>`;

        function writeToBody(bodyElem) {
          if (!bodyElem) return false;
          bodyElem.focus();
          // Clear and replace content
          bodyElem.innerHTML = formattedHtml;
          bodyElem.dispatchEvent(new Event('input', { bubbles: true }));
          bodyElem.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // Case A: Inside the CKEditor iframe
        if (document.body && (document.body.classList.contains('cke_editable') || document.body.getAttribute('contenteditable') === 'true')) {
          if (writeToBody(document.body)) actionsDone.body = true;
        }

        // Case B: Direct inner iframe
        if (!actionsDone.body) {
          const innerIframe = document.querySelector('iframe.cke_wysiwyg_frame') || 
                              document.querySelector('iframe[title="Email Body"]');
          if (innerIframe && innerIframe.contentDocument && innerIframe.contentDocument.body) {
            if (writeToBody(innerIframe.contentDocument.body)) actionsDone.body = true;
          }
        }

        // Case C: Outer iframe -> Inner iframe
        if (!actionsDone.body) {
          const allIframes = Array.from(document.querySelectorAll('iframe'));
          for (const outer of allIframes) {
            try {
              const outerDoc = outer.contentDocument || outer.contentWindow?.document;
              if (outerDoc) {
                const ckeBody = outerDoc.querySelector('body.cke_editable, div[contenteditable="true"]');
                if (ckeBody && writeToBody(ckeBody)) {
                  actionsDone.body = true;
                  break;
                }

                const nestedIframe = outerDoc.querySelector('iframe.cke_wysiwyg_frame') || 
                                     outerDoc.querySelector('iframe[title="Email Body"]');
                if (nestedIframe && nestedIframe.contentDocument && nestedIframe.contentDocument.body) {
                  if (writeToBody(nestedIframe.contentDocument.body)) {
                    actionsDone.body = true;
                    break;
                  }
                }
              }
            } catch (e) {}
          }
        }

        // Case D: CKEDITOR global instance
        if (!actionsDone.body && window.CKEDITOR && window.CKEDITOR.instances) {
          for (const k in window.CKEDITOR.instances) {
            const inst = window.CKEDITOR.instances[k];
            if (inst && inst.setData) {
              inst.setData(formattedHtml);
              actionsDone.body = true;
              break;
            }
          }
        }

        // ==========================================
        // 4. SEND BUTTON (If Fill & Send)
        // ==========================================
        if (data.shouldSend) {
          await sleep(400);
          const buttons = Array.from(
            document.querySelectorAll('button.slds-button_brand, button.slds-button')
          );
          const sendBtn = buttons.find((btn) => {
            const text = (btn.innerText || btn.textContent || "").trim().toLowerCase();
            const title = (btn.getAttribute('title') || "").trim().toLowerCase();
            return text === 'send' || title === 'send';
          });

          if (sendBtn && !sendBtn.disabled) {
            sendBtn.focus();
            await sleep(50);
            sendBtn.click();
            actionsDone.send = true;
          }
        }

        resolve({ success: true, actionsDone });
      } catch (e) {
        resolve({ success: false, error: e.message || String(e) });
      }
    });
  }

  // Execute across all frames in MAIN world
  async function executeInMainWorld(payload) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active Salesforce tab found.");
    }

    const tabId = tabs[0].id;

    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      world: 'MAIN',
      func: inPageRunner,
      args: [payload]
    });

    return results;
  }

  // Get current row payload mapped to fields
  function getCurrentRowData(shouldSend = false) {
    if (state.rows.length === 0 || state.currentRowIndex >= state.rows.length) {
      return null;
    }
    const row = state.rows[state.currentRowIndex];
    return {
      receiverEmail: row[state.mapping.receiverEmail] || '',
      emailSubject: row[state.mapping.emailSubject] || '',
      emailContent: row[state.mapping.emailContent] || '',
      shouldSend
    };
  }

  // Update UI Step Views
  function renderUI() {
    if (state.rows.length === 0) {
      stepUpload.classList.remove('hidden');
      stepMapping.classList.add('hidden');
      stepDashboard.classList.add('hidden');
      return;
    }

    if (!state.mapping.receiverEmail || !state.mapping.emailSubject || !state.mapping.emailContent) {
      stepUpload.classList.add('hidden');
      stepMapping.classList.remove('hidden');
      stepDashboard.classList.add('hidden');
      populateMappingOptions();
      return;
    }

    stepUpload.classList.add('hidden');
    stepMapping.classList.add('hidden');
    stepDashboard.classList.remove('hidden');

    const total = state.rows.length;
    const current = state.currentRowIndex + 1;
    const isCompleted = state.currentRowIndex >= total;

    if (isCompleted) {
      rowCounterBadge.textContent = `All ${total} Done! 🎉`;
      progressBarFill.style.width = '100%';
      prevTo.textContent = 'Completed';
      prevSubject.textContent = 'Completed';
      prevContent.textContent = 'All rows have been dispatched.';
      btnFillOnly.disabled = true;
      btnFillAndSend.disabled = true;
      return;
    }

    const pct = Math.round(((current - 1) / total) * 100);
    rowCounterBadge.textContent = `Row ${current} of ${total}`;
    progressBarFill.style.width = `${pct}%`;

    const data = getCurrentRowData(false);
    if (data) {
      prevTo.textContent = data.receiverEmail || '(Empty)';
      prevSubject.textContent = data.emailSubject || '(Empty)';
      prevContent.textContent = data.emailContent || '(Empty)';
    }

    btnFillOnly.disabled = false;
    btnFillAndSend.disabled = false;
    btnPrevRow.disabled = state.currentRowIndex === 0;
  }

  // --- Event Listeners ---

  tabBtnUpload.addEventListener('click', () => {
    tabBtnUpload.classList.add('active');
    tabBtnPaste.classList.remove('active');
    uploadFileSection.classList.remove('hidden');
    pasteTextSection.classList.add('hidden');
  });

  tabBtnPaste.addEventListener('click', () => {
    tabBtnPaste.classList.add('active');
    tabBtnUpload.classList.remove('active');
    pasteTextSection.classList.remove('hidden');
    uploadFileSection.classList.add('hidden');
  });

  btnParsePastedCSV.addEventListener('click', async () => {
    const rawText = csvTextInput.value.trim();
    if (!rawText) {
      showBanner("Please paste CSV content into the box first.", "error");
      return;
    }
    try {
      const parsed = parseCSV(rawText);
      await processParsedData("Pasted CSV", parsed);
    } catch (err) {
      showBanner(`CSV Error: ${err.message}`, "error");
    }
  });

  btnBackToUpload.addEventListener('click', () => {
    state.rows = [];
    state.headers = [];
    state.mapping = { receiverEmail: '', emailSubject: '', emailContent: '' };
    renderUI();
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = '#b0adab';
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#b0adab';
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  btnConfirmMapping.addEventListener('click', async () => {
    if (!colReceiverEmail.value) {
      showBanner("Please select a Receiver Email column", "error");
      return;
    }
    if (!colEmailSubject.value) {
      showBanner("Please select an Email Subject column", "error");
      return;
    }
    if (!colEmailContent.value) {
      showBanner("Please select an Email Content column", "error");
      return;
    }

    state.mapping.receiverEmail = colReceiverEmail.value;
    state.mapping.emailSubject = colEmailSubject.value;
    state.mapping.emailContent = colEmailContent.value;

    await saveState();
    showBanner("Mapping saved!", "success");
    renderUI();
  });

  btnChangeMapping.addEventListener('click', () => {
    state.mapping.receiverEmail = '';
    state.mapping.emailSubject = '';
    state.mapping.emailContent = '';
    renderUI();
  });

  // Fill Current Row Only
  btnFillOnly.addEventListener('click', async () => {
    const data = getCurrentRowData(false);
    if (!data) return;

    btnFillOnly.disabled = true;
    btnFillOnly.textContent = 'Filling...';

    try {
      await executeInMainWorld(data);
      showBanner(`Cleared & filled Row ${state.currentRowIndex + 1} into Salesforce!`, 'success');
    } catch (err) {
      showBanner(`Fill Error: ${err.message || err}`, 'error');
    } finally {
      btnFillOnly.disabled = false;
      btnFillOnly.textContent = '📝 Fill Current';
    }
  });

  // Fill and Send
  btnFillAndSend.addEventListener('click', async () => {
    const data = getCurrentRowData(true);
    if (!data) return;

    btnFillAndSend.disabled = true;
    btnFillAndSend.textContent = 'Sending...';

    try {
      await executeInMainWorld(data);
      showBanner(`Sent Row ${state.currentRowIndex + 1}! Moving to next...`, 'success');

      state.processedIndices.push(state.currentRowIndex);
      state.currentRowIndex++;
      await saveState();
      renderUI();
    } catch (err) {
      showBanner(`Send Error: ${err.message || err}`, 'error');
    } finally {
      btnFillAndSend.disabled = false;
      btnFillAndSend.textContent = '🚀 Fill & Send';
    }
  });

  // Skip Row
  btnSkipRow.addEventListener('click', async () => {
    if (state.currentRowIndex < state.rows.length) {
      state.currentRowIndex++;
      await saveState();
      renderUI();
      showBanner(`Skipped to Row ${state.currentRowIndex + 1}`, 'info');
    }
  });

  // Previous Row
  btnPrevRow.addEventListener('click', async () => {
    if (state.currentRowIndex > 0) {
      state.currentRowIndex--;
      await saveState();
      renderUI();
    }
  });

  // Reset Progress
  btnResetProgress.addEventListener('click', async () => {
    if (confirm("Reset progress to Row 1? (CSV data and mapping will be kept)")) {
      state.currentRowIndex = 0;
      state.processedIndices = [];
      await saveState();
      renderUI();
      showBanner("Progress reset to Row 1", "info");
    }
  });

  // Initialization
  await loadState();
  if (state.fileName && state.rows.length > 0) {
    uploadFilename.textContent = `${state.fileName} (${state.rows.length} rows)`;
  }
  renderUI();
});
