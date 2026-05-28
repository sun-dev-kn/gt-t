// scraper/rotation.js
import { loadAccounts, updateAccount } from "./accounts.js";

const ROTATION_KEY = "scraper_rotation";

async function getRotation() {
  const result = await browser.storage.local.get(ROTATION_KEY);
  return result[ROTATION_KEY] ?? { index: 0, lastScrapeAt: null };
}

async function saveRotation(r) {
  await browser.storage.local.set({ [ROTATION_KEY]: r });
}

export async function getNextAccount() {
  const accounts = await loadAccounts();
  if (accounts.length === 0) return null;

  const rotation = await getRotation();
  const now = Date.now();

  for (let i = 0; i < accounts.length; i++) {
    const idx = (rotation.index + i) % accounts.length;
    const account = accounts[idx];

    if (account.status === "error") continue;

    if (account.status === "suspended" && account.suspendedUntil) {
      if (new Date(account.suspendedUntil).getTime() > now) continue;
      await updateAccount(account.id, { status: "active", suspendedUntil: null });
      accounts[idx] = { ...account, status: "active", suspendedUntil: null };
    }

    await saveRotation({ index: (idx + 1) % accounts.length, lastScrapeAt: now });
    await updateAccount(account.id, { lastUsed: new Date().toISOString() });
    return accounts[idx];
  }

  return null;
}

export async function suspendAccount(id, hours) {
  const suspendedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await updateAccount(id, { status: "suspended", suspendedUntil });
}

export async function markAccountError(id) {
  await updateAccount(id, { status: "error", suspendedUntil: null });
}

export async function getLastScrapeAt() {
  const r = await getRotation();
  return r.lastScrapeAt;
}
