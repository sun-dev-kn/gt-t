// scraper/log.js
const LOG_KEY = "scraper_log";
const MAX_LOG = 100;

export async function appendLog(entry) {
  const result = await browser.storage.local.get(LOG_KEY);
  const log = result[LOG_KEY] ?? [];
  log.unshift({ timestamp: new Date().toISOString(), ...entry });
  await browser.storage.local.set({ [LOG_KEY]: log.slice(0, MAX_LOG) });
}

export async function getLog() {
  const result = await browser.storage.local.get(LOG_KEY);
  return result[LOG_KEY] ?? [];
}

export async function clearLog() {
  await browser.storage.local.remove(LOG_KEY);
}
