import { MSG, PAGE_META, PAGE_TYPES, UPWORK_SEARCH_URL } from '../shared/constants.js';
import { clearData, getState, logActivity, onStorageChange, updateSettings } from '../shared/storage.js';
import { detectPageType } from '../shared/upwork.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const ui = {
  version: $('#version'),
  themeToggle: $('#themeToggle'),
  openUpwork: $('#openUpwork'),
  pageCard: $('#pageCard'),
  pageLabel: $('#pageLabel'),
  pageUrl: $('#pageUrl'),
  pageHint: $('#pageHint'),
  pageBadgeText: $('#pageBadgeText'),
  scrapeBtn: $('#scrapeBtn'),
  scrapeBtnText: $('#scrapeBtnText'),
  statTotal: $('#statTotal'),
  statToday: $('#statToday'),
  statLast: $('#statLast'),
  tabs: $('.tabs'),
  jobsCount: $('#jobsCount'),
  jobSearch: $('#jobSearch'),
  jobList: $('#jobList'),
  jobsEmpty: $('#jobsEmpty'),
  jobsEmptyTitle: $('#jobsEmptyTitle'),
  jobsEmptyText: $('#jobsEmptyText'),
  activityList: $('#activityList'),
  activityEmpty: $('#activityEmpty'),
  themeSegmented: $('#themeSegmented'),
  clearData: $('#clearData'),
  footerNote: $('#footerNote'),
  exportCsv: $('#exportCsv'),
  exportJson: $('#exportJson'),
  toasts: $('#toasts'),
};

let state = { settings: {}, jobs: [], activity: [] };
let activeTab = null;
let pageType = PAGE_TYPES.NOT_UPWORK;
let jobQuery = '';

// ---------- Helpers ----------

/** Tiny DOM builder; children may be strings or nodes. Text is never parsed as HTML. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value);
  }
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function relativeTime(ts, { short = false } = {}) {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 45) return short ? 'now' : 'just now';
  const units = [
    [60, 'm', 'minute'],
    [24, 'h', 'hour'],
    [7, 'd', 'day'],
  ];
  let value = sec / 60;
  for (const [limit, s, long] of units) {
    if (value < limit) {
      const n = Math.max(1, Math.round(value));
      return short ? `${n}${s}` : `${n} ${long}${n === 1 ? '' : 's'} ago`;
    }
    value /= limit;
  }
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname === '/' ? '' : u.pathname);
  } catch {
    return url || 'No page';
  }
}

function toast(message, type = 'info', duration = 2800) {
  const iconName = { success: 'check', error: 'alert', info: 'info' }[type] ?? 'info';
  const node = el('div', { class: 'toast', dataset: { type }, role: 'status' }, icon(iconName), el('span', {}, message));
  ui.toasts.append(node);
  setTimeout(() => {
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }, duration);
}

// ---------- Theme ----------

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function isDark(theme) {
  return theme === 'dark' || (theme === 'system' && darkQuery.matches);
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;

  ui.themeToggle.querySelector('use').setAttribute('href', isDark(theme) ? '#i-moon' : '#i-sun');
  for (const btn of ui.themeSegmented.querySelectorAll('button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.value === theme));
  }
}

async function setTheme(theme) {
  applyTheme(theme);
  await updateSettings({ theme });
}

// ---------- Tabs ----------

function selectTab(name) {
  const tabs = $$('.tab');
  tabs.forEach((tab, i) => {
    const selected = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(selected));
    if (selected) ui.tabs.style.setProperty('--tab-index', i);
  });
  for (const panel of $$('.panel')) panel.hidden = panel.dataset.panel !== name;
}

// ---------- Current page ----------

async function detectPage() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pageType = detectPageType(activeTab?.url ?? '');
  const meta = PAGE_META[pageType];

  const cardState =
    pageType === PAGE_TYPES.NOT_UPWORK ? 'unavailable' : meta.scrapable ? 'ready' : 'partial';
  ui.pageCard.dataset.state = cardState;
  ui.pageLabel.textContent = meta.label;
  ui.pageUrl.textContent = formatUrl(activeTab?.url);
  ui.pageUrl.title = activeTab?.url ?? '';
  ui.pageHint.textContent = meta.hint;
  ui.pageBadgeText.textContent = { ready: 'Ready', partial: 'Idle', unavailable: 'Inactive' }[cardState];

  // Off Upwork, the primary action becomes a shortcut to the job search.
  if (meta.scrapable) {
    ui.scrapeBtn.dataset.action = 'scrape';
    ui.scrapeBtnText.textContent = 'Scrape this page';
    ui.scrapeBtn.querySelector('use').setAttribute('href', '#i-zap');
  } else {
    ui.scrapeBtn.dataset.action = 'open';
    ui.scrapeBtnText.textContent = 'Open Upwork job search';
    ui.scrapeBtn.querySelector('use').setAttribute('href', '#i-external');
  }
  ui.scrapeBtn.disabled = false;
}

/** Ping the content script; inject it if the tab was open before the extension loaded. */
async function ensureContentScript(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: MSG.PING });
    if (res?.ok) return res.data;
  } catch {
    // No receiver yet — fall through and inject.
  }
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/content/content.js'] });
  const res = await chrome.tabs.sendMessage(tabId, { type: MSG.PING });
  if (!res?.ok) throw new Error(res?.error ?? 'The page did not respond.');
  return res.data;
}

function setScraping(loading) {
  ui.scrapeBtn.disabled = loading;
  ui.scrapeBtn.classList.toggle('is-loading', loading);
  ui.scrapeBtnText.textContent = loading ? 'Connecting…' : 'Scrape this page';
}

async function onPrimaryAction() {
  if (ui.scrapeBtn.dataset.action === 'open') {
    await chrome.tabs.create({ url: UPWORK_SEARCH_URL });
    window.close();
    return;
  }

  setScraping(true);
  try {
    await ensureContentScript(activeTab.id);
    // Extraction is wired up in the next feature step.
    toast('Connected to the page. Job extraction comes next!', 'success');
    await logActivity('info', `Connected to ${PAGE_META[pageType].label.toLowerCase()}`);
  } catch (err) {
    toast(err.message || 'Could not reach the page.', 'error');
    await logActivity('error', `Connection failed: ${err.message}`);
  } finally {
    setScraping(false);
  }
}

// ---------- Rendering ----------

function renderStats() {
  const { jobs } = state;
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const lastScrape = jobs.reduce((max, j) => Math.max(max, j.scrapedAt ?? 0), 0);

  ui.statTotal.textContent = jobs.length.toLocaleString();
  ui.statToday.textContent = jobs.filter((j) => (j.scrapedAt ?? 0) >= startOfDay).length.toLocaleString();
  ui.statLast.textContent = lastScrape ? relativeTime(lastScrape, { short: true }) : '—';
  ui.jobsCount.textContent = jobs.length > 99 ? '99+' : String(jobs.length);

  const hasJobs = jobs.length > 0;
  ui.exportCsv.disabled = !hasJobs;
  ui.exportJson.disabled = !hasJobs;
  ui.footerNote.textContent = `${jobs.length.toLocaleString()} job${jobs.length === 1 ? '' : 's'} ready to export`;
}

function jobCard(job) {
  const meta = [
    job.budget && el('span', { class: 'budget' }, job.budget),
    job.jobType && el('span', {}, job.jobType),
    job.postedAt && el('span', {}, job.postedAt),
    job.client?.country && el('span', {}, job.client.country),
  ];
  const skills = job.skills ?? [];
  const chips = skills.slice(0, 3).map((s) => el('span', { class: 'chip' }, s));
  if (skills.length > 3) chips.push(el('span', { class: 'chip' }, `+${skills.length - 3}`));

  return el(
    'li',
    {},
    el(
      'a',
      { class: 'job-card', href: job.url, target: '_blank', rel: 'noopener' },
      el('div', { class: 'job-title' }, job.title || 'Untitled job'),
      el('div', { class: 'job-meta' }, meta),
      chips.length ? el('div', { class: 'chips' }, chips) : null,
    ),
  );
}

function renderJobs() {
  const q = jobQuery.trim().toLowerCase();
  const visible = q
    ? state.jobs.filter((j) => [j.title, ...(j.skills ?? [])].some((v) => v?.toLowerCase().includes(q)))
    : state.jobs;

  ui.jobList.replaceChildren(...visible.map(jobCard));
  ui.jobsEmpty.hidden = visible.length > 0;

  if (state.jobs.length && !visible.length) {
    ui.jobsEmptyTitle.textContent = 'No matches';
    ui.jobsEmptyText.textContent = `Nothing in your saved jobs matches “${jobQuery.trim()}”.`;
  } else {
    ui.jobsEmptyTitle.textContent = 'No jobs collected yet';
    ui.jobsEmptyText.replaceChildren(
      'Open an Upwork job search and hit ',
      el('b', {}, 'Scrape this page'),
      '. Jobs you collect will show up here.',
    );
  }
}

function renderActivity() {
  const iconFor = { success: 'check', error: 'alert', info: 'info' };
  ui.activityList.replaceChildren(
    ...state.activity.map((a) =>
      el(
        'li',
        { class: 'activity-item', dataset: { type: a.type } },
        el('div', { class: 'activity-icon' }, icon(iconFor[a.type] ?? 'info')),
        el(
          'div',
          { class: 'activity-body' },
          el('div', { class: 'activity-msg' }, a.message),
          el('div', { class: 'activity-time', title: new Date(a.at).toLocaleString() }, relativeTime(a.at)),
        ),
      ),
    ),
  );
  ui.activityEmpty.hidden = state.activity.length > 0;
}

function renderAll() {
  applyTheme(state.settings.theme);
  renderStats();
  renderJobs();
  renderActivity();
}

// ---------- Events ----------

function bindEvents() {
  ui.themeToggle.addEventListener('click', () => setTheme(isDark(state.settings.theme) ? 'light' : 'dark'));
  ui.themeSegmented.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-value]');
    if (btn) setTheme(btn.dataset.value);
  });
  darkQuery.addEventListener('change', () => applyTheme(state.settings.theme));

  ui.openUpwork.addEventListener('click', async () => {
    await chrome.tabs.create({ url: UPWORK_SEARCH_URL });
    window.close();
  });

  ui.scrapeBtn.addEventListener('click', onPrimaryAction);

  ui.tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) selectTab(tab.dataset.tab);
  });

  ui.jobSearch.addEventListener('input', (e) => {
    jobQuery = e.target.value;
    renderJobs();
  });

  // Two-step confirm: first click arms the button, second click within 3s clears.
  let clearTimer = null;
  ui.clearData.addEventListener('click', async () => {
    const label = ui.clearData.lastChild;
    if (!clearTimer) {
      label.textContent = 'Confirm';
      clearTimer = setTimeout(() => {
        label.textContent = 'Clear';
        clearTimer = null;
      }, 3000);
      return;
    }
    clearTimeout(clearTimer);
    clearTimer = null;
    label.textContent = 'Clear';
    await clearData();
    toast('Scraped data cleared.', 'success');
  });

  onStorageChange(async () => {
    state = await getState();
    renderAll();
  });
}

// ---------- Init ----------

async function init() {
  ui.version.textContent = chrome.runtime.getManifest().version;
  state = await getState();
  renderAll();
  bindEvents();
  await detectPage();
}

init().catch((err) => {
  console.error(err);
  toast('Something went wrong loading the popup.', 'error');
});
