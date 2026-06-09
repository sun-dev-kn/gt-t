CREATE TABLE IF NOT EXISTS intel_checks (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL DEFAULT 'manual',
  category    TEXT NOT NULL DEFAULT 'dynamic',
  label       TEXT NOT NULL,
  paths       TEXT NOT NULL,
  validate_js TEXT NOT NULL DEFAULT 'return true;',
  severity    TEXT NOT NULL DEFAULT 'high',
  match_any   INTEGER NOT NULL DEFAULT 1,
  cve_id      TEXT,
  cvss_score  REAL,
  description TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  version     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS telegram_messages (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id           TEXT NOT NULL,
  update_id            INTEGER NOT NULL UNIQUE,
  message_text         TEXT NOT NULL,
  received_at          INTEGER NOT NULL,
  processed            INTEGER NOT NULL DEFAULT 0,
  extracted_check_id   TEXT
);

CREATE TABLE IF NOT EXISTS finding_enrichments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  check_id    TEXT NOT NULL,
  site_url    TEXT NOT NULL,
  cve_id      TEXT,
  cvss_score  REAL,
  cvss_vector TEXT,
  remediation TEXT,
  references  TEXT,
  ai_summary  TEXT,
  enriched_at INTEGER NOT NULL
);
