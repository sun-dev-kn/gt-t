// Reads PROXY_URL env var — comma-separated list of proxy URLs
// e.g. PROXY_URL=http://user:pass@proxy1:3128,http://user:pass@proxy2:3128
// Returns null if no proxies configured (direct connection)

let proxies = [];
let currentIndex = 0;

function loadProxies() {
  const raw = process.env.PROXY_URL || '';
  proxies = raw.split(',').map(p => p.trim()).filter(Boolean);
}

loadProxies();

export function getNextProxy() {
  if (proxies.length === 0) return null;
  const proxy = proxies[currentIndex % proxies.length];
  currentIndex++;
  return proxy;
}

export function getProxyCount() {
  return proxies.length;
}
