import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  json       TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  tools      TEXT NOT NULL DEFAULT '[]',
  status     TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'interrupted', 'error')),
  created_at TEXT NOT NULL
);
`;

/** Opens (and creates if needed) a database. Pass ":memory:" in tests. */
export function openDb(file: string): Db {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

const DEFAULT_PATH = path.join(process.cwd(), "data", "app.db");

// Cached on globalThis so dev-mode hot reloads reuse one connection.
const globalForDb = globalThis as unknown as { __profileBuilderDb?: Db };

/** The app's shared database connection (server only). */
export function getDb(): Db {
  globalForDb.__profileBuilderDb ??= openDb(process.env.DATABASE_PATH ?? DEFAULT_PATH);
  return globalForDb.__profileBuilderDb;
}

/** Runs fn inside a write transaction, rolling back if it throws. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
