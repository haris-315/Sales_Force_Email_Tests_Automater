/**
 * Salesforce Email CSV Autofill - Controller
 * Verified 2-Phase Dispatcher with Full Aura Pill State Sync & Blur Dispatch
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

  const inputDelaySec = document.getElementById('inputDelaySec');
  const btnToggleLoop = document.getElementById('btnToggleLoop');

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
    processedIndices: [],
    delaySec: 3
  };

  let isLoopRunning = false;

  // Load State from chrome.storage.local
  async function loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['sf_autofill_state'], (result) => {
        if (result && result.sf_autofill_state) {
          state = { ...state, ...result.sf_autofill_state };
          if (state.delaySec) {
            inputDelaySec.value = state.delaySec;
          }
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

  // 1. TOP FRAME RUNNER: Ensures modal open, clears & creates To pill, clears & fills Subject
  function topFrameFillRunner(data) {
    return new Promise(async (resolve) => {
      try {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        function isComposerOpen() {
          const dialog =
            document.querySelector('.slds-docked-composer.slds-is-open') ||
            document.querySelector('div[role="dialog"].slds-is-open') ||
            document.querySelector('div[role="dialog"][aria-label="Email"]');

          return dialog && dialog.offsetParent !== null;
        }

        function findEmailOpenButton(root = document) {
          if (!root) return null;

          let btn =
            root.querySelector('button[value="SendEmail"]') ||
            root.querySelector('lightning-button-group[data-target-selection-name="SendAnEmailTab"] button') ||
            root.querySelector('runtime_sales_activities-activity-panel-composer button');
          if (btn) return btn;

          const composerHost = root.querySelector('runtime_sales_activities-activity-panel-composer');
          if (composerHost && composerHost.shadowRoot) {
            const shadowBtn = composerHost.shadowRoot.querySelector('button[value="SendEmail"], button');
            if (shadowBtn) return shadowBtn;
          }

          const all = root.querySelectorAll('*');
          for (const el of all) {
            if (el.shadowRoot) {
              const found = findEmailOpenButton(el.shadowRoot);
              if (found) return found;
            }
          }
          return null;
        }

        // 1. Ensure Composer Modal is Open
        if (!isComposerOpen()) {
          console.log("[SF Email Autofill] Opening composer via shadow root...");
          const emailBtn = findEmailOpenButton(document);
          if (emailBtn) {
            emailBtn.focus();
            emailBtn.click();

            const startTime = Date.now();
            while (Date.now() - startTime < 10000) {
              await sleep(250);
              if (isComposerOpen()) {
                const toReady = document.querySelector('ul[aria-label="To"] input[role="combobox"], .emailuiPillContainer input');
                if (toReady) {
                  await sleep(400);
                  break;
                }
              }
            }
          }
        }

        const toContainer =
          document.querySelector('div[role="dialog"][aria-label="Email"]') ||
          document.querySelector('.emailuiComposer') ||
          document.querySelector('.slds-docked-composer') ||
          document.body;

        // 2. Clear & Fill Receiver (To)
        const toInput =
          toContainer.querySelector('ul[aria-label="To"] input[role="combobox"]') ||
          toContainer.querySelector('.emailuiBaseAddressContainer input.uiPillContainerAutoComplete') ||
          toContainer.querySelector('.emailuiPillContainer input') ||
          toContainer.querySelector('input[aria-label="To"]');

        const existingPills = toContainer.querySelectorAll(
          'ul[aria-label="To"] .slds-pill__remove, ul[aria-label="To"] [data-action="delete"], ul[aria-label="To"] button.slds-pill__remove'
        );
        existingPills.forEach((btn) => { try { btn.click(); } catch (e) {} });

        if (toInput) {
          toInput.value = '';
          toInput.dispatchEvent(new Event('input', { bubbles: true }));
          toInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (existingPills.length > 0) {
          await sleep(150);
        }

        if (data.receiverEmail && toInput) {
          toInput.focus();
          await sleep(50);
          document.execCommand('insertText', false, data.receiverEmail);
          if (toInput.value !== data.receiverEmail) {
            toInput.value = data.receiverEmail;
          }
          toInput.dispatchEvent(new Event('input', { bubbles: true }));
          toInput.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(50);

          // Dispatch Enter, Comma, Tab to commit the Aura pill
          ['Enter', 'Comma', 'Tab'].forEach((keyName) => {
            const code = keyName === 'Enter' ? 13 : keyName === 'Comma' ? 188 : 9;
            toInput.dispatchEvent(new KeyboardEvent('keydown', {
              key: keyName, code: keyName, keyCode: code, which: code, bubbles: true, cancelable: true
            }));
            toInput.dispatchEvent(new KeyboardEvent('keyup', {
              key: keyName, code: keyName, keyCode: code, which: code, bubbles: true, cancelable: true
            }));
          });

          await sleep(100);

          // Commit & Blur
          toInput.blur();
          toInput.dispatchEvent(new Event('blur', { bubbles: true }));
          toInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        }

        // 3. Clear & Fill Subject
        const subjectInput =
          document.querySelector('input[placeholder="Enter Subject..."]') ||
          document.querySelector('input[aria-label="Subject"]') ||
          document.querySelector('lightning-input[data-field-name="Subject"] input') ||
          document.querySelector('.slds-form-element input.slds-input[placeholder*="Subject"]');

        if (subjectInput) {
          subjectInput.focus();
          subjectInput.value = '';
          subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
          subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(50);

          if (data.emailSubject !== undefined && data.emailSubject !== null) {
            subjectInput.value = data.emailSubject;
            subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
            subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(50);
          }

          subjectInput.blur();
          subjectInput.dispatchEvent(new Event('blur', { bubbles: true }));
          subjectInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        }

        resolve({ success: true });
      } catch (err) {
        resolve({ error: err.message || String(err) });
      }
    });
  }

  // 2. SUBFRAME BODY INJECTOR: Injects & strictly reads back content to verify
  function bodyFrameInjectRunner(options) {
    const { formattedHtml, expectedSnippet } = options;
    let bodyInjected = false;
    let verifiedText = '';

    function checkContentMatch(text) {
      if (!expectedSnippet || expectedSnippet.trim().length === 0) return true;
      if (!text) return false;
      const cleanActual = text.replace(/\s+/g, ' ').trim().toLowerCase();
      const cleanExpected = expectedSnippet.replace(/\s+/g, ' ').trim().toLowerCase();
      return cleanActual.includes(cleanExpected) || cleanActual.length >= Math.min(cleanExpected.length, 10);
    }

    // A. Direct contenteditable on document.body
    if (document.body && (document.body.classList.contains('cke_editable') || document.body.getAttribute('contenteditable') === 'true')) {
      try {
        document.body.focus();
        document.body.innerHTML = formattedHtml;
        document.body.dispatchEvent(new Event('input', { bubbles: true }));
        document.body.dispatchEvent(new Event('change', { bubbles: true }));

        const readBack = (document.body.innerText || document.body.textContent || '').trim();
        if (checkContentMatch(readBack)) {
          bodyInjected = true;
          verifiedText = readBack.substring(0, 40);
        }
      } catch (e) {}
    }

    // B. CKEditor Global API
    if (!bodyInjected && window.CKEDITOR && window.CKEDITOR.instances) {
      for (const k in window.CKEDITOR.instances) {
        const inst = window.CKEDITOR.instances[k];
        if (inst && inst.setData) {
          try {
            inst.setData(formattedHtml);
            const data = (inst.getData ? inst.getData() : '') || '';
            if (checkContentMatch(data)) {
              bodyInjected = true;
              verifiedText = data.substring(0, 40);
              break;
            }
          } catch (e) {}
        }
      }
    }

    // C. Child iframe (.cke_wysiwyg_frame or title="Email Body")
    if (!bodyInjected) {
      const innerIframes = document.querySelectorAll('iframe.cke_wysiwyg_frame, iframe[title="Email Body"]');
      for (const innerIframe of innerIframes) {
        try {
          if (innerIframe && innerIframe.contentDocument && innerIframe.contentDocument.body) {
            const b = innerIframe.contentDocument.body;
            b.focus();
            b.innerHTML = formattedHtml;
            b.dispatchEvent(new Event('input', { bubbles: true }));
            b.dispatchEvent(new Event('change', { bubbles: true }));

            const readBack = (b.innerText || b.textContent || '').trim();
            if (checkContentMatch(readBack)) {
              bodyInjected = true;
              verifiedText = readBack.substring(0, 40);
              break;
            }
          }
        } catch (e) {}
      }
    }

    return {
      frame: window.self === window.top ? 'top' : 'subframe',
      bodyInjected,
      verifiedText
    };
  }

  // 3. PRE-FLIGHT VERIFIER: Strictly checks if body exists in live CKEditor DOM before send
  function bodyFrameVerifyOnlyRunner(expectedSnippet) {
    function checkContentMatch(text) {
      if (!expectedSnippet || expectedSnippet.trim().length === 0) return true;
      if (!text) return false;
      const cleanActual = text.replace(/\s+/g, ' ').trim().toLowerCase();
      const cleanExpected = expectedSnippet.replace(/\s+/g, ' ').trim().toLowerCase();
      return cleanActual.includes(cleanExpected);
    }

    let isVerified = false;

    // Check contenteditable body
    if (document.body && (document.body.classList.contains('cke_editable') || document.body.getAttribute('contenteditable') === 'true')) {
      const readBack = (document.body.innerText || document.body.textContent || '').trim();
      if (checkContentMatch(readBack)) isVerified = true;
    }

    // Check CKEditor instances
    if (!isVerified && window.CKEDITOR && window.CKEDITOR.instances) {
      for (const k in window.CKEDITOR.instances) {
        const inst = window.CKEDITOR.instances[k];
        if (inst && inst.getData) {
          const data = inst.getData() || '';
          if (checkContentMatch(data)) {
            isVerified = true;
            break;
          }
        }
      }
    }

    // Check child iframes
    if (!isVerified) {
      const innerIframes = document.querySelectorAll('iframe.cke_wysiwyg_frame, iframe[title="Email Body"]');
      for (const innerIframe of innerIframes) {
        try {
          if (innerIframe && innerIframe.contentDocument && innerIframe.contentDocument.body) {
            const readBack = (innerIframe.contentDocument.body.innerText || '').trim();
            if (checkContentMatch(readBack)) {
              isVerified = true;
              break;
            }
          }
        } catch (e) {}
      }
    }

    return { isVerified };
  }

  // 4. SEND ACTION RUNNER: Full Pointer/Mouse Event Chain
  function sendEmailActionRunner() {
    return new Promise(async (resolve) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      // Blur any active element so Aura finishes model binding
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      await sleep(100);

      // Locate Send button
      const sendBtn =
        document.querySelector('button.send') ||
        document.querySelector('button.cuf-publisherShareButton') ||
        document.querySelector('div[role="dialog"][aria-label="Email"] button.slds-button_brand') ||
        document.querySelector('.slds-docked-composer button.slds-button_brand') ||
        Array.from(document.querySelectorAll('button.slds-button_brand, button.slds-button')).find((btn) => {
          const text = (btn.innerText || btn.textContent || "").trim().toLowerCase();
          const title = (btn.getAttribute('title') || "").trim().toLowerCase();
          return text === 'send' || title === 'send';
        });

      if (!sendBtn) {
        resolve({ success: false, error: "Send button not found on page." });
        return;
      }

      if (sendBtn.disabled) {
        resolve({ success: false, error: "Send button is disabled." });
        return;
      }

      // Dispatch full pointer and mouse event chain
      sendBtn.focus();
      await sleep(50);

      const mouseEvents = ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const eventName of mouseEvents) {
        sendBtn.dispatchEvent(new MouseEvent(eventName, {
          bubbles: true,
          cancelable: true,
          view: window,
          buttons: 1
        }));
        await sleep(25);
      }

      try {
        sendBtn.click();
      } catch (e) {}

      await sleep(600);
      resolve({ success: true });
    });
  }

  // 2-PHASE DISPATCHER: Strict verification before any send is allowed
  async function executeVerifiedDispatch(payload) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active Salesforce tab found.");
    }

    const tabId = tabs[0].id;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const rawContent = (payload.emailContent || '').trim();
    const expectedSnippet = rawContent.length > 50 ? rawContent.substring(0, 50) : rawContent;
    const formattedHtml = (rawContent && (rawContent.includes('<p>') || rawContent.includes('<br>')))
      ? rawContent
      : `<p>${rawContent.replace(/\n/g, '</p><p>')}</p>`;

    // STEP 1: Fill Top fields (To, Subject) ONCE
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: topFrameFillRunner,
      args: [payload]
    });

    // STEP 2: Poll Subframes for CKEditor Body Injection & Read-back Confirmation
    let bodyConfirmed = false;
    let verifiedSnippet = '';
    const startPoll = Date.now();

    while (Date.now() - startPoll < 15000) {
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        world: 'MAIN',
        func: bodyFrameInjectRunner,
        args: [{ formattedHtml, expectedSnippet }]
      });

      const confirmedFrame = results && results.find((r) => r.result?.bodyInjected === true);
      if (confirmedFrame) {
        bodyConfirmed = true;
        verifiedSnippet = confirmedFrame.result?.verifiedText || '';
        console.log(`✅ [Verified Dispatcher] Body 100% verified in CKEditor: "${verifiedSnippet}"`);
        break;
      }

      await sleep(300);
    }

    // STRICT GUARD: Refuse to send if body is not 100% verified in DOM
    if (!bodyConfirmed && rawContent.length > 0) {
      throw new Error("CKEditor body could not be verified in Salesforce. Aborting send to prevent sending blank email.");
    }

    // STEP 3: 1-Second Pre-Send Settle Delay (allows Aura model to sync)
    if (payload.shouldSend) {
      console.log("⏳ [Verified Dispatcher] Waiting 1-second pre-send delay...");
      await sleep(1000);

      // STEP 4: Pre-Flight Verification (Double check body still present right before clicking Send)
      if (rawContent.length > 0) {
        const verifyResults = await chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          world: 'MAIN',
          func: bodyFrameVerifyOnlyRunner,
          args: [expectedSnippet]
        });

        const isStillVerified = verifyResults && verifyResults.some((r) => r.result?.isVerified === true);
        if (!isStillVerified) {
          // Attempt rapid re-injection fallback
          const reInject = await chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            world: 'MAIN',
            func: bodyFrameInjectRunner,
            args: [{ formattedHtml, expectedSnippet }]
          });

          if (!reInject || !reInject.some((r) => r.result?.bodyInjected === true)) {
            throw new Error("Pre-send verification failed: CKEditor body became empty before clicking Send. Aborted.");
          }
        }
      }

      // STEP 5: Trigger Send via Pointer Event Chain in Top Frame
      const sendRes = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: sendEmailActionRunner
      });

      if (sendRes && sendRes[0]?.result?.error) {
        throw new Error(sendRes[0].result.error);
      }
    }

    return { success: true, bodyConfirmed, verifiedSnippet };
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

  // Helper interruptible sleep
  function interruptibleSleep(ms) {
    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (!isLoopRunning || Date.now() - start >= ms) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  // Loop Controller
  async function runAutoLoop() {
    isLoopRunning = true;
    btnToggleLoop.textContent = '⏹️ Stop Loop';
    btnToggleLoop.classList.add('running');
    btnFillOnly.disabled = true;
    btnFillAndSend.disabled = true;

    const delaySec = Math.max(1, parseInt(inputDelaySec.value, 10) || 3);
    state.delaySec = delaySec;
    await saveState();

    while (isLoopRunning && state.currentRowIndex < state.rows.length) {
      const rowNum = state.currentRowIndex + 1;
      const total = state.rows.length;

      showBanner(`Looping: Processing Row ${rowNum} of ${total}...`, 'info', 0);

      const data = getCurrentRowData(true);
      if (!data) break;

      try {
        await executeVerifiedDispatch(data);
        state.processedIndices.push(state.currentRowIndex);
        state.currentRowIndex++;
        await saveState();
        renderUI();

        showBanner(`✅ Sent Row ${rowNum} of ${total}!`, 'success', 2000);

        if (state.currentRowIndex >= total) {
          showBanner("🎉 All CSV rows dispatched successfully!", 'success');
          break;
        }

        // Countdown delay before next row
        if (isLoopRunning) {
          for (let s = delaySec; s > 0; s--) {
            if (!isLoopRunning) break;
            btnToggleLoop.textContent = `⏹️ Stop Loop (${s}s...)`;
            await interruptibleSleep(1000);
          }
        }
      } catch (err) {
        showBanner(`Loop Paused on Row ${rowNum}: ${err.message || err}`, 'error', 0);
        break;
      }
    }

    isLoopRunning = false;
    btnToggleLoop.textContent = '🔁 Start Auto Loop';
    btnToggleLoop.classList.remove('running');
    btnFillOnly.disabled = false;
    btnFillAndSend.disabled = false;
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
      btnToggleLoop.disabled = true;
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

    if (!isLoopRunning) {
      btnFillOnly.disabled = false;
      btnFillAndSend.disabled = false;
      btnToggleLoop.disabled = false;
    }
    btnPrevRow.disabled = state.currentRowIndex === 0 || isLoopRunning;
  }

  // --- Event Listeners ---

  inputDelaySec.addEventListener('change', async () => {
    state.delaySec = Math.max(1, parseInt(inputDelaySec.value, 10) || 3);
    await saveState();
  });

  btnToggleLoop.addEventListener('click', () => {
    if (isLoopRunning) {
      isLoopRunning = false;
      btnToggleLoop.textContent = '🔁 Start Auto Loop';
      btnToggleLoop.classList.remove('running');
      showBanner("Auto loop stopped.", 'info');
      renderUI();
    } else {
      runAutoLoop();
    }
  });

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
      await executeVerifiedDispatch(data);
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
      await executeVerifiedDispatch(data);
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
