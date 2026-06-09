import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { callAI } from './ai.js';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_TEMPLATE = readFileSync(join(__dirname, '../prompts/enrich-finding.txt'), 'utf8');

export async function enrichFinding({ checkId, checkLabel, siteUrl, matchedPath, responseSnippet = '' }) {
  // Check cache: don't re-enrich same (checkId, site hostname) within 7 days
  const db = getDb();
  const hostname = new URL(siteUrl).hostname;
  const cached = db.prepare(`
    SELECT * FROM finding_enrichments
    WHERE check_id = ? AND site_url LIKE ?
    AND enriched_at > ?
  `).get(checkId, `%${hostname}%`, Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (cached) {
    return {
      cve_id: cached.cve_id,
      cvss_score: cached.cvss_score,
      cvss_vector: cached.cvss_vector,
      remediation: cached.remediation,
      references: JSON.parse(cached.references || '[]'),
      ai_summary: cached.ai_summary,
    };
  }

  const prompt = PROMPT_TEMPLATE
    .replace('{{CHECK_ID}}', checkId)
    .replace('{{CHECK_LABEL}}', checkLabel || checkId)
    .replace('{{SITE_URL}}', siteUrl)
    .replace('{{MATCHED_PATH}}', matchedPath)
    .replace('{{RESPONSE_SNIPPET}}', responseSnippet.slice(0, 500));

  let enrichment;
  try {
    const response = await callAI(prompt, true);
    const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    enrichment = JSON.parse(cleaned);
  } catch (err) {
    console.error('[enricher] Failed to parse AI response:', err.message);
    return null;
  }

  // Cache in DB
  try {
    db.prepare(`
      INSERT INTO finding_enrichments
        (check_id, site_url, cve_id, cvss_score, cvss_vector, remediation, references, ai_summary, enriched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      checkId, siteUrl,
      enrichment.cve_id || null,
      enrichment.cvss_score || null,
      enrichment.cvss_vector || null,
      enrichment.remediation || null,
      JSON.stringify(enrichment.references || []),
      enrichment.ai_summary || null,
      Date.now(),
    );
  } catch (err) {
    console.error('[enricher] DB cache error:', err.message);
  }

  return enrichment;
}
