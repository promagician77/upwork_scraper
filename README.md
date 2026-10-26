# Upwork Scraper (Chrome extension, MV3)

Collect, organize and export Upwork job posts in one click.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Pin the extension and open the popup.

After editing files, click the reload icon on the extension card. Content-script changes also need the Upwork tab to be refreshed.

## Structure

```
manifest.json                  MV3 manifest
icons/                         icon.svg source + PNG sizes
src/
  background/service-worker.js Storage init + message router (ES module)
  content/content.js           Runs on www.upwork.com; answers popup messages
  popup/                       Popup UI (html / css / js)
  shared/
    constants.js               Message types, page types, labels
    storage.js                 chrome.storage.local wrapper (settings, jobs, activity)
    upwork.js                  URL → page type detection
  styles/tokens.css            Design tokens (light/dark), shared by all pages
```

No build step: plain ES modules. `content.js` is a classic script (Chrome requirement), so it mirrors the message type strings from `constants.js`.

## Data model (`chrome.storage.local`)

| Key        | Shape                                                              |
| ---------- | ------------------------------------------------------------------ |
| `settings` | `{ theme: 'system' \| 'light' \| 'dark', autoScrape, notifyNewJobs }` |
| `jobs`     | `[{ id, title, url, budget, jobType, postedAt, skills[], client{}, scrapedAt }]` |
| `activity` | `[{ id, type: 'info' \| 'success' \| 'error', message, at }]` (latest 50) |

## Roadmap

- [x] Basic structure, popup UI, theming, page detection, content-script handshake
- [ ] Scrape job search results / Find Work feed
- [ ] Scrape a single job's full details
- [ ] Save + de-duplicate jobs
- [ ] Export CSV / JSON
- [ ] Filters (budget, job type, client rating, country)
- [ ] Auto-scrape + new job notifications
