import { Router } from 'express';
import { enrichFinding } from '../services/enricher.js';
import rateLimit from 'express-rate-limit';

const router = Router();

const enrichLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enrichment requests, please try again later.' },
});

router.post('/enrich', enrichLimiter, async (req, res) => {
  const { check_id, check_label, site_url, matched_path, response_snippet } = req.body;

  if (!check_id || !site_url || !matched_path) {
    return res.status(400).json({ error: 'check_id, site_url, and matched_path are required' });
  }

  try {
    const enrichment = await enrichFinding({
      checkId: check_id,
      checkLabel: check_label || check_id,
      siteUrl: site_url,
      matchedPath: matched_path,
      responseSnippet: response_snippet || '',
    });

    if (!enrichment) {
      return res.status(503).json({ error: 'Enrichment failed — AI unavailable' });
    }

    res.json(enrichment);

    // Fire-and-forget push notification for high/critical findings
    const notifySeverities = new Set(['critical', 'high']);
    const reqSeverity = (req.body.severity || '').toLowerCase();
    const cvssHigh = (enrichment?.cvss_score ?? 0) >= 7;
    if (notifySeverities.has(reqSeverity) || cvssHigh) {
      import('../services/notifier.js').then(({ notifyFinding }) => {
        notifyFinding({
          checkId: req.body.check_id || 'unknown',
          siteUrl: req.body.site_url || '',
          severity: reqSeverity || (cvssHigh ? 'high' : 'unknown'),
          enrichment,
        }).catch(err => console.error('[enrich] notify error:', err.message));
      });
    }
  } catch (err) {
    console.error('[enrich route]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
