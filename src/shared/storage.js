import { MAX_ACTIVITY } from './constants.js';

const area = chrome.storage.local;

export const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system', // 'system' | 'light' | 'dark'
  autoScrape: false,
  notifyNewJobs: false,
});

const DEFAULTS = {
  settings: DEFAULT_SETTINGS,
  jobs: [],
  activity: [],
};

/** Seed missing keys and merge new setting defaults into existing settings. */
export async function initStorage() {
  const current = await area.get(Object.keys(DEFAULTS));
  await area.set({
    settings: { ...DEFAULT_SETTINGS, ...current.settings },
    jobs: current.jobs ?? DEFAULTS.jobs,
    activity: current.activity ?? DEFAULTS.activity,
  });
}

export async function getState() {
  const { settings, jobs, activity } = await area.get(Object.keys(DEFAULTS));
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    jobs: jobs ?? [],
    activity: activity ?? [],
  };
}

export async function updateSettings(partial) {
  const { settings } = await area.get('settings');
  const next = { ...DEFAULT_SETTINGS, ...settings, ...partial };
  await area.set({ settings: next });
  return next;
}

export async function logActivity(type, message) {
  const { activity = [] } = await area.get('activity');
  const entry = { id: crypto.randomUUID(), type, message, at: Date.now() };
  await area.set({ activity: [entry, ...activity].slice(0, MAX_ACTIVITY) });
  return entry;
}

/** Remove scraped data but keep settings. */
export async function clearData() {
  await area.set({ jobs: [], activity: [] });
}

export function onStorageChange(callback) {
  const listener = (changes, areaName) => {
    if (areaName === 'local') callback(changes);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
