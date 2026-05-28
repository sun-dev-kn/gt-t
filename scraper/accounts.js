// scraper/accounts.js
import { encrypt, decrypt } from "./crypto.js";

const STORAGE_KEY = "scraper_accounts";

export async function loadAccounts() {
  const result = await browser.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] ?? [];
}

async function saveAccounts(accounts) {
  await browser.storage.local.set({ [STORAGE_KEY]: accounts });
}

export async function importAccounts(records) {
  const existing = await loadAccounts();
  const existingEmails = new Set(existing.map((a) => a.email));
  const added = [];

  for (const r of records) {
    if (!r.email || !r.password) continue;
    if (existingEmails.has(r.email)) continue;
    const { iv, data } = await encrypt(r.password);
    added.push({
      id: crypto.randomUUID(),
      email: r.email,
      encryptedPassword: data,
      iv,
      label: r.label || r.email,
      status: "active",
      suspendedUntil: null,
      cookieStoreId: null,
      lastUsed: null,
    });
    existingEmails.add(r.email);
  }

  await saveAccounts([...existing, ...added]);
  return added.length;
}

export async function getDecryptedPassword(account) {
  return decrypt({ iv: account.iv, data: account.encryptedPassword });
}

export async function updateAccount(id, patch) {
  const accounts = await loadAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return;
  accounts[idx] = { ...accounts[idx], ...patch };
  await saveAccounts(accounts);
}

export async function deleteAccount(id) {
  const accounts = await loadAccounts();
  await saveAccounts(accounts.filter((a) => a.id !== id));
}

export async function clearAllAccounts() {
  await browser.storage.local.remove(STORAGE_KEY);
}

export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

export function parseJSON(text) {
  return JSON.parse(text);
}
