/**
 * Salesforce Lightning Email Composer DOM Automation Content Script
 * Version: 3.0.0
 */

(function () {
  console.log("[SF Email Autofill v3.0] Ready.");

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Find the exact CKEditor iframe anywhere on the page
  function getCKEditorIframe() {
    // 1. Direct query
    let iframe = document.querySelector('iframe.cke_wysiwyg_frame') || 
                 document.querySelector('iframe[title="Email Body"]');
    if (iframe) return iframe;

    // 2. Loop through all iframes on page
    const iframes = Array.from(document.getElementsByTagName('iframe'));
    for (const f of iframes) {
      const title = f.getAttribute('title') || '';
      const cls = f.className || '';
      if (title.toLowerCase().includes('email') || title.toLowerCase().includes('body') || cls.includes('cke_')) {
        return f;
      }
    }

    return null;
  }

  function getActiveEmailComposer() {
    return (
      document.querySelector('div[role="dialog"][aria-label="Email"]') ||
      document.querySelector('.emailuiComposer') ||
      document.querySelector('section[role="dialog"][aria-label="Email"]') ||
      document.body
    );
  }

  // 1. Receiver (To)
  async function setReceiverEmail(container, email) {
    if (!email) return { success: true };

    const existingPills = container.querySelectorAll(
      'ul[aria-label="To"] .slds-pill__remove, ul[aria-label="To"] [data-action="delete"]'
    );
    existingPills.forEach((btn) => {
      try { btn.click(); } catch (e) {}
    });

    if (existingPills.length > 0) {
      await sleep(150);
    }

    const toInput =
      container.querySelector('ul[aria-label="To"] input[role="combobox"]') ||
      container.querySelector('.emailuiBaseAddressContainer input.uiPillContainerAutoComplete') ||
      container.querySelector('.emailuiPillContainer input') ||
      container.querySelector('input[aria-label="To"]');

    if (!toInput) {
      throw new Error("Could not find 'To' input field.");
    }

    toInput.focus();
    await sleep(50);

    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, email);
    } catch (e) {
      inserted = false;
    }

    if (!inserted || toInput.value !== email) {
      toInput.value = email;
    }

    toInput.dispatchEvent(new Event('input', { bubbles: true }));
    toInput.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(50);

    toInput.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
    }));
    toInput.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true
    }));

    return { success: true };
  }

  // 2. Subject
  async function setSubject(container, subject) {
    if (subject === undefined || subject === null) return { success: true };

    const subjectInput =
      container.querySelector('input[placeholder="Enter Subject..."]') ||
      container.querySelector('input[aria-label="Subject"]') ||
      container.querySelector('lightning-input[data-field-name="Subject"] input') ||
      container.querySelector('.slds-form-element input.slds-input[placeholder*="Subject"]');

    if (!subjectInput) {
      throw new Error("Could not find Subject input field.");
    }

    subjectInput.focus();
    await sleep(50);

    subjectInput.value = subject;
    subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
    subjectInput.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true };
  }

  // 3. Body Content (Using exact tested console method)
  async function setBodyContent(content) {
    if (content === undefined || content === null || content === '') {
      return { success: true };
    }

    const formattedHtml = (content.includes('<p>') || content.includes('<br>'))
      ? content
      : `<p>${content.replace(/\n/g, '</p><p>')}</p>`;

    const iframe = getCKEditorIframe();

    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc && doc.body) {
        doc.body.focus();
        await sleep(50);
        doc.body.innerHTML = formattedHtml;
        doc.body.dispatchEvent(new Event('input', { bubbles: true }));
        doc.body.dispatchEvent(new Event('change', { bubbles: true }));
        doc.body.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
        return { success: true };
      }
    }

    throw new Error("CKEditor iframe not found on page.");
  }

  // 4. Send Button
  async function triggerSend(container) {
    const buttons = Array.from(
      container.querySelectorAll('button.slds-button_brand, button.slds-button')
    );

    const sendButton = buttons.find((btn) => {
      const text = (btn.innerText || btn.textContent || "").trim().toLowerCase();
      const title = (btn.getAttribute('title') || "").trim().toLowerCase();
      return text === 'send' || title === 'send';
    });

    if (!sendButton) {
      throw new Error("Could not find the 'Send' button.");
    }

    if (sendButton.disabled) {
      throw new Error("Send button is disabled.");
    }

    sendButton.focus();
    await sleep(50);
    sendButton.click();

    return { success: true };
  }

  async function handleFill(payload) {
    const container = getActiveEmailComposer();
    await setReceiverEmail(container, payload.receiverEmail);
    await sleep(100);
    await setSubject(container, payload.emailSubject);
    await sleep(100);
    await setBodyContent(payload.emailContent);
    return { success: true };
  }

  // Runtime Message Listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        switch (message.action) {
          case 'PING':
            sendResponse({ success: true, version: '3.0.0' });
            break;

          case 'FILL_FIELDS':
            const fillRes = await handleFill(message.data);
            sendResponse({ success: true, result: fillRes });
            break;

          case 'SEND_EMAIL':
            const container = getActiveEmailComposer();
            const sendRes = await triggerSend(container);
            sendResponse({ success: true, result: sendRes });
            break;

          case 'FILL_AND_SEND':
            await handleFill(message.data);
            await sleep(400);
            const activeContainer = getActiveEmailComposer();
            const fullSendRes = await triggerSend(activeContainer);
            sendResponse({ success: true, result: fullSendRes });
            break;

          default:
            sendResponse({ success: false, error: `Unknown action: ${message.action}` });
        }
      } catch (err) {
        console.error("[SF Email Autofill Error]", err);
        sendResponse({ success: false, error: err.message || String(err) });
      }
    })();

    return true;
  });
})();
