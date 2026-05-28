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
      // still offline — append new items to existing cache
      await setCached([...cached, ...items]);
      return { inserted: 0, skipped: 0, cached: cached.length + items.length };
    }
  }

  try {
    const result = await postWithRetry(backendUrl, workflowId, scrapedBy, items);

    // cache recent items for popup display
    const { scraper_recent_launches: existing = [] } = await browser.storage.local.get("scraper_recent_launches");
    const seen = new Set(items.map((i) => i.url));
    const deduped = [...items, ...existing.filter((e) => !seen.has(e.url))].slice(0, 50);
    await browser.storage.local.set({ scraper_recent_launches: deduped });

    return { ...result, cached: 0 };
  } catch {
    // send failed — add to the (now-empty) cache
    await setCached([...items]);
    return { inserted: 0, skipped: 0, cached: items.length };
  }
}
