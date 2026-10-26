// Message types exchanged between popup, background and content script.
// NOTE: content.js is a classic script (no imports) and mirrors these strings.
export const MSG = Object.freeze({
  PING: 'US_PING',
  SCRAPE_PAGE: 'US_SCRAPE_PAGE',
});

export const PAGE_TYPES = Object.freeze({
  SEARCH: 'search',
  FEED: 'feed',
  JOB: 'job',
  UPWORK_OTHER: 'upwork_other',
  NOT_UPWORK: 'not_upwork',
});

export const PAGE_META = Object.freeze({
  [PAGE_TYPES.SEARCH]: { label: 'Job search results', hint: 'Ready to collect every job on this page.', scrapable: true },
  [PAGE_TYPES.FEED]: { label: 'Find Work feed', hint: 'Ready to collect jobs from your feed.', scrapable: true },
  [PAGE_TYPES.JOB]: { label: 'Job details', hint: 'Ready to collect this job with full details.', scrapable: true },
  [PAGE_TYPES.UPWORK_OTHER]: { label: 'Upwork', hint: 'Open a job search or job post to start scraping.', scrapable: false },
  [PAGE_TYPES.NOT_UPWORK]: { label: 'Not on Upwork', hint: 'Navigate to upwork.com to start scraping.', scrapable: false },
});

export const UPWORK_SEARCH_URL = 'https://www.upwork.com/nx/search/jobs/';

export const MAX_ACTIVITY = 50;
