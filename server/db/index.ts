import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Local durable store.
 *
 * Uses Node's built-in SQLite so the API keeps working with zero external
 * services. Everything that must survive a restart lives here: portal sessions,
 * every browser event, approvals and evidence.
 */

const DB_PATH = process.env.JANSETU_DB_PATH?.trim() || join(process.cwd(), 'data', 'jansetu.db')

let db: DatabaseSync | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS portal_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  organisation_id TEXT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  current_url TEXT,
  created_at TEXT NOT NULL,
  last_activity TEXT NOT NULL,
  closed_at TEXT
);

CREATE TABLE IF NOT EXISTS browser_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  url TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS action_approvals (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  user_id TEXT NOT NULL,
  organisation_id TEXT,
  action TEXT NOT NULL,
  url TEXT,
  payload_hash TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved_at TEXT,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  url TEXT,
  label TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session ON browser_events(session_id);
CREATE INDEX IF NOT EXISTS idx_evidence_session ON evidence(session_id);
CREATE INDEX IF NOT EXISTS idx_approvals_session ON action_approvals(session_id);
`

export function getDb(): DatabaseSync {
  if (db) return db
  if (DB_PATH !== ':memory:') mkdirSync(dirname(DB_PATH), { recursive: true })
  db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(SCHEMA)
  return db
}

export const dbPath = DB_PATH