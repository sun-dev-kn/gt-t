// scraper/orchestrate.js
import { ensureContainer } from "./containers.js";
import { getNextAccount, suspendAccount, markAccountError } from "./rotation.js";
import { loadAccounts } from "./accounts.js";
import { runMacroInContainer } from "./uivision.js";
import { relay } from "./relay.js";
import { appendLog } from "./log.js";

const SETTINGS_KEY = "scraper_settings";

async function getSettings() {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return result[SETTINGS_KEY] ?? {
    backendUrl: "http://localhost:3000",
    workflowId: "",
    enabled: false,
    apiKey: "",
  };
}

export async function saveScraperSettings(settings) {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}

export async function getScraperSettings() {
  return getSettings();
}

export async function runScrapeCycle() {
  const settings = await getSettings();

  if (!settings.enabled) return;

  if (!settings.workflowId) {
    await appendLog({
      accountEmail: null,
      itemsInserted: 0,
      itemsSkipped: 0,
      cached: 0,
      error: "No workflowId configured",
    });
    return;
  }

  const account = await getNextAccount();
  if (!account) {
    await appendLog({
      accountEmail: null,
      itemsInserted: 0,
      itemsSkipped: 0,
      cached: 0,
      error: "No active accounts available",
    });
    browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("/icons/dotgit-48.png"),
      title: "DotGit Scraper — No Accounts Available",
      message: "All accounts are suspended or in error state. Open Options to check the account pool.",
    });
    return;
  }

  try {
    const allAccounts = await loadAccounts();
    const accountIndex = allAccounts.findIndex((a) => a.id === account.id);
    const cookieStoreId = await ensureContainer(account, accountIndex >= 0 ? accountIndex : 0);
    const items = await runMacroInContainer(cookieStoreId);

    if (!items || items.length === 0) {
      await appendLog({
        accountEmail: account.email,
        itemsInserted: 0,
        itemsSkipped: 0,
        cached: 0,
        error: null,
      });
      return;
    }

    const result = await relay(
      settings.backendUrl,
      settings.workflowId,
      account.email,
      items,
      settings.apiKey
    );

    await appendLog({
      accountEmail: account.email,
      itemsInserted: result.inserted,
      itemsSkipped: result.skipped,
      cached: result.cached,
      error: null,
    });

    if (result.cached > 0) {
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("/icons/dotgit-48.png"),
        title: "DotGit Scraper",
        message: "Backend unreachable — results cached locally.",
      });
    } else {
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("/icons/dotgit-48.png"),
        title: "DotGit Scraper",
        message: `Scraped ${result.inserted} new launches.`,
      });
    }
  } catch (e) {
    const msg = e?.message ?? String(e);

    if (/rate.?limit|429|too many requests/i.test(msg)) {
      await suspendAccount(account.id, 48);
    } else if (msg.toLowerCase().includes("login") || msg.toLowerCase().includes("auth")) {
      await markAccountError(account.id);
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("/icons/dotgit-48.png"),
        title: "DotGit Scraper — Login Failed",
        message: `${account.email} needs attention.`,
      });
    } else {
      await suspendAccount(account.id, 24);
    }

    await appendLog({
      accountEmail: account.email,
      itemsInserted: 0,
      itemsSkipped: 0,
      cached: 0,
      error: msg,
    });
  }
}
