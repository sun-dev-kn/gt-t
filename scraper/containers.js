// scraper/containers.js
import { loadAccounts, updateAccount } from "./accounts.js";

const COLORS = ["blue", "turquoise", "green", "yellow", "orange", "red", "pink", "purple"];

export async function ensureContainer(account, colorIndex = 0) {
  if (account.cookieStoreId) {
    try {
      await browser.contextualIdentities.get(account.cookieStoreId);
      return account.cookieStoreId;
    } catch {
      // container deleted externally — recreate
    }
  }

  const container = await browser.contextualIdentities.create({
    name: `DotGit: ${account.email}`,
    color: COLORS[colorIndex % COLORS.length],
    icon: "briefcase",
  });

  await updateAccount(account.id, { cookieStoreId: container.cookieStoreId });
  return container.cookieStoreId;
}

export async function ensureAllContainers() {
  const accounts = await loadAccounts();
  for (let i = 0; i < accounts.length; i++) {
    await ensureContainer(accounts[i], i);
  }
}

export async function removeContainer(cookieStoreId) {
  if (!cookieStoreId) return;
  try {
    await browser.contextualIdentities.remove(cookieStoreId);
  } catch {
    // already gone
  }
}
