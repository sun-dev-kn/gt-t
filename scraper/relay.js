// scraper/relay.js
const CACHE_KEY = "scraper_pending_launches";
const MAX_CACHE = 1000;

async function getCached() {
  const result = await browser.storage.local.get(CACHE_KEY);
  return result[CACHE_KEY] ?? [];
}

async function setCached(items) {
  await browser.storage.local.set({ [CACHE_KEY]: items.slice(-MAX_CACHE) });
}

async function postOnce(backendUrl, workflowId, scrapedBy, items) {
  const res = await fetch(`${backendUrl}/api/launches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workflowId, scrapedBy, items }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postWithRetry(backendUrl, workflowId, scrapedBy, items) {
  const delays = [1000, 5000, 15000];
  let last;
  for (const delay of delays) {
    try {
      return await postOnce(backendUrl, workflowId, scrapedBy, items);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}

export async function relay(backendUrl, workflowId, scrapedBy, items) {
  const cached = await getCached();

  if (cached.length > 0) {
    try {
      await postWithRetry(backendUrl, workflowId, scrapedBy, cached);
      await setCached([]);
    } catch {
      await setCached([...cached, ...items]);
      return { inserted: 0, skipped: 0, cached: items.length };
    }
  }

  try {
    const result = await postWithRetry(backendUrl, workflowId, scrapedBy, items);

    // cache recent items for popup display
    const { scraper_recent_launches: existing = [] } = await browser.storage.local.get("scraper_recent_launches");
    const merged = [...items, ...existing].slice(0, 50);
    await browser.storage.local.set({ scraper_recent_launches: merged });

    return { ...result, cached: 0 };
  } catch {
    await setCached([...(await getCached()), ...items]);
    return { inserted: 0, skipped: 0, cached: items.length };
  }
}
