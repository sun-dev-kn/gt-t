import { fetch, ProxyAgent } from 'undici';
import { getNextProxy } from './proxy-pool.js';

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_BODY_SNIPPET = 500;

/**
 * Fire a single HTTP probe to a target URL+path.
 * Returns { path, status, bodySnippet, matched: false } — caller decides if matched.
 */
async function probeOne(targetUrl, path, timeoutMs, proxyUrl) {
  const url = targetUrl.replace(/\/$/, '') + path;
  const options = {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
    },
  };

  if (proxyUrl) {
    options.dispatcher = new ProxyAgent(proxyUrl);
  }

  try {
    const response = await fetch(url, options);
    const status = response.status;
    let bodySnippet = '';
    if (status === 200) {
      const text = await response.text();
      bodySnippet = text.slice(0, MAX_BODY_SNIPPET);
    }
    return { path, status, bodySnippet, matched: false };
  } catch (err) {
    return { path, status: 0, bodySnippet: '', matched: false, error: err.message };
  }
}

/**
 * Fire probes for all paths against a target URL.
 * Applies optional jitter delay between probes.
 */
export async function probeAll(targetUrl, paths, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const proxyUrl = getNextProxy();
  const minDelay = parseInt(process.env.RELAY_MIN_DELAY_MS || '200', 10);
  const maxDelay = parseInt(process.env.RELAY_MAX_DELAY_MS || '1500', 10);

  const results = [];
  for (const path of paths) {
    const result = await probeOne(targetUrl, path, timeoutMs, proxyUrl);
    results.push(result);

    // Jitter between probes
    if (paths.indexOf(path) < paths.length - 1) {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  return results;
}

/**
 * Get the outbound IP address used for probing (for audit logging).
 */
export async function getOutboundIp() {
  try {
    const proxyUrl = getNextProxy();
    const options = { signal: AbortSignal.timeout(5000) };
    if (proxyUrl) options.dispatcher = new ProxyAgent(proxyUrl);
    const res = await fetch('https://api.ipify.org?format=json', options);
    const data = await res.json();
    return data.ip || 'unknown';
  } catch {
    return 'unknown';
  }
}
