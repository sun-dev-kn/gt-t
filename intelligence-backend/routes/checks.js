import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';

const router = Router();

router.get('/checks', (req, res) => {
  const db = getDb();
  const since = parseInt(req.query.since || '0', 10);

  const checks = db.prepare(`
    SELECT id, source, category, label, paths, validate_js, severity,
           match_any, cve_id, cvss_score, description, updated_at
    FROM intel_checks
    WHERE enabled = 1 AND updated_at > ?
    ORDER BY updated_at DESC
  `).all(since);

  // Compute version hash from all enabled check ids
  const allIds = db.prepare('SELECT id FROM intel_checks WHERE enabled = 1 ORDER BY id').all().map(r => r.id);
  const version = crypto.createHash('sha256').update(allIds.join(',')).digest('hex');

  res.json({ version, checks, deleted_ids: [] });
});

export default router;
