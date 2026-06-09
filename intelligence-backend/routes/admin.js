import { Router } from 'express';
import { runCycle } from '../services/scheduler.js';
import { getDb } from '../db.js';

const router = Router();

// Admin auth middleware — requires ADMIN_API_KEY env var
router.use((req, res, next) => {
  // Health check is public
  if (req.path === '/health' && req.method === 'GET') return next();

  const adminKey = process.env.ADMIN_API_KEY || process.env.INTEL_API_KEY;
  const auth = req.headers['authorization'];
  if (!adminKey || !auth || auth !== `Bearer ${adminKey}`) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

router.post('/intel/refresh', async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const channelIds = (process.env.TELEGRAM_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);

  try {
    const result = await runCycle(botToken, channelIds);
    res.json(result);
  } catch (err) {
    console.error('[admin/refresh]', err);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

router.get('/health', (req, res) => {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as n FROM intel_checks WHERE enabled = 1').get();
  res.json({
    ok: true,
    db_checks: count.n,
    timestamp: new Date().toISOString(),
  });
});

export default router;
