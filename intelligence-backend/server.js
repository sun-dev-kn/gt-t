import express from 'express';
import checksRouter from './routes/checks.js';
import enrichRouter from './routes/enrich.js';
import adminRouter from './routes/admin.js';
import { getDb } from './db.js';
import { startScheduler } from './services/scheduler.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const INTEL_API_KEY = process.env.INTEL_API_KEY || '';

if (!INTEL_API_KEY) {
  console.warn('[intel] WARNING: INTEL_API_KEY is not set. All /api/checks and /api/enrich requests will be rejected.');
}

const app = express();
app.use(express.json());

// API key auth for public-facing routes
app.use('/api', (req, res, next) => {
  // Health is unauthenticated
  if (req.path === '/health' && req.method === 'GET') return next();

  const auth = req.headers['authorization'];
  if (!INTEL_API_KEY || !auth || auth !== `Bearer ${INTEL_API_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.use('/api', checksRouter);
app.use('/api', enrichRouter);
app.use('/api', adminRouter);

// Initialize DB (runs schema migrations)
getDb();

// Start Telegram scheduler if configured
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const channelIds = (process.env.TELEGRAM_CHANNELS || '').split(',').map(s => s.trim()).filter(Boolean);
if (botToken && channelIds.length > 0) {
  startScheduler(botToken, channelIds);
  console.log(`[intel] Telegram scheduler started for channels: ${channelIds.join(', ')}`);
}

app.listen(PORT, () => {
  console.log(`[intel] Intelligence backend listening on port ${PORT}`);
});
