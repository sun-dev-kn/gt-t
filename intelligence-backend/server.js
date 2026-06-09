import express from 'express';
import checksRouter from './routes/checks.js';
import enrichRouter from './routes/enrich.js';
import adminRouter from './routes/admin.js';
import { getDb } from './db.js';
import { startScheduler } from './services/scheduler.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const INTEL_API_KEY = process.env.INTEL_API_KEY || '';

function validateStartupConfig() {
  if (!process.env.INTEL_API_KEY) {
    console.error('[intel] ✖  INTEL_API_KEY is not set — all API requests will be rejected (401)');
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('[intel] ⚠  ANTHROPIC_API_KEY is not set — /api/enrich will fail');
  }
  if (process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_CHANNELS) {
    console.warn('[intel] ⚠  TELEGRAM_BOT_TOKEN set but TELEGRAM_CHANNELS is empty — scheduler will not start');
  }
  if (!process.env.NOTIFY_TELEGRAM_BOT_TOKEN && !process.env.NOTIFY_SLACK_WEBHOOK_URL) {
    console.info('[intel] ℹ  No push notification channels configured (NOTIFY_TELEGRAM_BOT_TOKEN / NOTIFY_SLACK_WEBHOOK_URL)');
  }
}

validateStartupConfig();

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
