import Fastify from 'fastify';
import { createAuthHook } from './auth.js';
import { probeAll, getOutboundIp } from './probe.js';
import { getProxyCount } from './proxy-pool.js';

const PORT = parseInt(process.env.PORT || '4001', 10);
const API_KEY = process.env.RELAY_API_KEY || '';

if (!API_KEY) {
  console.warn('[relay] WARNING: RELAY_API_KEY is not set. Server will reject all requests.');
}

const fastify = Fastify({ logger: true });

// Auth hook applied to all routes
fastify.addHook('preHandler', createAuthHook(API_KEY));

/**
 * POST /api/probe
 * Body: { targetUrl: string, paths: string[], timeoutMs?: number }
 * Response: { results: ProbeResult[], probeIp: string }
 */
fastify.post('/api/probe', {
  schema: {
    body: {
      type: 'object',
      required: ['targetUrl', 'paths'],
      properties: {
        targetUrl: { type: 'string', format: 'uri' },
        paths: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 500 },
        timeoutMs: { type: 'number', minimum: 1000, maximum: 30000, default: 10000 },
      },
    },
  },
}, async (request, reply) => {
  const { targetUrl, paths, timeoutMs } = request.body;
  const results = await probeAll(targetUrl, paths, timeoutMs);
  const probeIp = await getOutboundIp();
  return { results, probeIp };
});

/**
 * GET /api/health
 */
fastify.get('/api/health', async () => {
  return {
    ok: true,
    proxyCount: getProxyCount(),
    timestamp: new Date().toISOString(),
  };
});

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[relay] Listening on port ${PORT}`);
  if (getProxyCount() > 0) {
    console.log(`[relay] Using ${getProxyCount()} proxy/proxies`);
  } else {
    console.log('[relay] No proxies configured — using direct connection');
  }
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
