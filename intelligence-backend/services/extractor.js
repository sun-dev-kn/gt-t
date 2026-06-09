import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { callAI } from './ai.js';
import { getDb } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_TEMPLATE = readFileSync(join(__dirname, '../prompts/extract-checks.txt'), 'utf8');

export async function extractChecksFromMessage(messageText, channelId, updateId) {
  const prompt = PROMPT_TEMPLATE + '\n' + messageText;

  let parsed;
  try {
    const response = await callAI(prompt, false);
    // Strip markdown code fences if present
    const cleaned = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error('[extractor] Failed to parse AI response:', err.message);
    return [];
  }

  const checks = parsed.checks || [];
  if (checks.length === 0) return [];

  const db = getDb();
  const now = Date.now();
  const inserted = [];

  for (const check of checks) {
    if (!check.id || !check.label || !check.paths || !Array.isArray(check.paths)) continue;
    // Ensure id has dynamic_ prefix
    if (!check.id.startsWith('dynamic_')) check.id = 'dynamic_' + check.id;

    try {
      db.prepare(`
        INSERT OR REPLACE INTO intel_checks
          (id, source, category, label, paths, validate_js, severity, match_any,
           cve_id, cvss_score, description, created_at, updated_at, enabled, version)
        VALUES (?, 'telegram', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 1,
          COALESCE((SELECT version + 1 FROM intel_checks WHERE id = ?), 1))
      `).run(
        check.id,
        check.category || 'dynamic',
        check.label,
        JSON.stringify(check.paths),
        check.validate_js || 'return true;',
        check.severity || 'high',
        check.cve_id || null,
        check.cvss_score || null,
        check.description || null,
        now, now,
        check.id,
      );
      inserted.push(check.id);
    } catch (err) {
      console.error('[extractor] DB insert error:', err.message);
    }
  }

  // Mark telegram message as processed
  if (updateId) {
    db.prepare('UPDATE telegram_messages SET processed = 1, extracted_check_id = ? WHERE update_id = ?')
      .run(inserted[0] || null, updateId);
  }

  return inserted;
}
