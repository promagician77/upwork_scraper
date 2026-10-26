import { initStorage, logActivity } from '../shared/storage.js';

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await initStorage();
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await logActivity('info', 'Extension installed. Welcome aboard!');
  }
});

// Message router: add a handler per message type as features land.
// Each handler receives (payload, sender) and returns a value or a promise.
const handlers = {};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handler = handlers[msg?.type];
  if (!handler) return false;

  Promise.resolve(handler(msg.payload, sender))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
  return true; // keep the channel open for the async response
});
