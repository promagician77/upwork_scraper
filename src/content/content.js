// Runs on www.upwork.com pages. Classic script (content scripts can't be ES modules),
// so message types are mirrored from src/shared/constants.js.
(() => {
  if (window.__upworkScraperLoaded) return;
  window.__upworkScraperLoaded = true;

  const MSG = {
    PING: 'US_PING',
    SCRAPE_PAGE: 'US_SCRAPE_PAGE',
  };

  const handlers = {
    [MSG.PING]: () => ({ ready: true, url: location.href, title: document.title }),
  };

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const handler = handlers[msg?.type];
    if (!handler) return false;

    Promise.resolve()
      .then(() => handler(msg.payload))
      .then((data) => sendResponse({ ok: true, data }))
      .catch((err) => sendResponse({ ok: false, error: err?.message ?? String(err) }));
    return true;
  });
})();
