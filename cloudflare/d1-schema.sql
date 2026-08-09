
CREATE TABLE IF NOT EXISTS write_rules(
 rule_id TEXT NOT NULL PRIMARY KEY,
 type TEXT NOT NULL,
 lookup_key TEXT NOT NULL,
 payload_json TEXT NOT NULL DEFAULT '{}',
 confidence_level TEXT NOT NULL DEFAULT 'AUTO_INFERRED',
 priority INTEGER NOT NULL DEFAULT 300,
 source TEXT NOT NULL DEFAULT 'LOCAL',
 confirmed INTEGER NOT NULL DEFAULT 0,
 device_id TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 deleted INTEGER NOT NULL DEFAULT 0,
 UNIQUE(type,lookup_key)
);
CREATE INDEX IF NOT EXISTS idx_write_rules_updated_at ON write_rules(updated_at);
CREATE INDEX IF NOT EXISTS idx_write_rules_type ON write_rules(type);
