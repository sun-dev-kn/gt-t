// scraper/relay.js

const CACHE_KEY = "scraper_pending_launches";
const MAX_CACHE = 1000;

async function getCached() {
  const result = await browser.storage.local.get(CACHE_KEY);
  return result[CACHE_KEY] ?? [];
}

async function setCached(envelopes) {
  await browser.storage.local.set({ [CACHE_KEY]: envelopes.slice(-MAX_CACHE) });
}

async function postOnce(backendUrl, workflowId, scrapedBy, items, apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${backendUrl}/api/launches`, {
    method: "POST",
    headers,
    body: JSON.stringify({ workflowId, scrapedBy, items }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postWithRetry(backendUrl, workflowId, scrapedBy, items, apiKey) {
  const delays = [1000, 5000, 15000];
  let last;
  for (const delay of delays) {
    try {
      return await postOnce(backendUrl, workflowId, scrapedBy, items, apiKey);
    } catch (e) {
      last = e;
      // don't retry on client errors (4xx except 408/429)
      const status = parseInt(e.message.replace("HTTP ", ""));
      if (!isNaN(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw last;
      }
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw last;
}

// Sends items to backend. Flushes cached envelopes first (each with original context).
// Returns { inserted, skipped, cached } where cached = items that couldn't be sent.
export async function relay(backendUrl, workflowId, scrapedBy, items, apiKey) {
  const cached = await getCached();

  // Try to flush cache first (each envelope has its own workflowId/scrapedBy)
  if (cached.length > 0) {
    const remaining = [];
    for (const envelope of cached) {
      try {
        await postWithRetry(
          backendUrl,
          envelope.workflowId,
          envelope.scrapedBy,
          envelope.items,
          apiKey
        );
      } catch {
        remaining.push(envelope);
      }
    }
    await setCached(remaining);
    if (remaining.length > 0) {
      // still offline — cache new items too and bail
      await setCached([...remaining, { workflowId, scrapedBy, items }]);
      return { inserted: 0, skipped: 0, cached: items.length };
    }
  }

  // Send new items
  try {
    const result = await postWithRetry(backendUrl, workflowId, scrapedBy, items, apiKey);

    // Cache recent items for popup display (deduplicated by URL)
    const { scraper_recent_launches: existing = [] } = await browser.storage.local.get("scraper_recent_launches");
    const seen = new Set(items.map((i) => i.url));
    const deduped = [...items, ...existing.filter((e) => !seen.has(e.url))].slice(0, 50);
    await browser.storage.local.set({ scraper_recent_launches: deduped });

    return { ...result, cached: 0 };
  } catch {
    await setCached([...await getCached(), { workflowId, scrapedBy, items }]);
    return { inserted: 0, skipped: 0, cached: items.length };
  }
}
