import { PAGE_TYPES } from './constants.js';

/** Classify a URL into one of PAGE_TYPES. */
export function detectPageType(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return PAGE_TYPES.NOT_UPWORK;
  }
  if (!/(^|\.)upwork\.com$/.test(u.hostname)) return PAGE_TYPES.NOT_UPWORK;

  const path = u.pathname;
  if (/^\/nx\/search\/jobs/.test(path)) return PAGE_TYPES.SEARCH;
  if (/^\/nx\/find-work/.test(path)) return PAGE_TYPES.FEED;
  if (/^\/(jobs\/|nx\/jobs\/|freelance-jobs\/apply\/)/.test(path) || /~0[0-9a-z]+/i.test(path)) {
    return PAGE_TYPES.JOB;
  }
  return PAGE_TYPES.UPWORK_OTHER;
}
