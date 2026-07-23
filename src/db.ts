import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS chats (
    chat_id INTEGER PRIMARY KEY,
    session_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const getStmt = db.prepare<{ chatId: number }>(
  "SELECT session_id as sessionId FROM chats WHERE chat_id = @chatId"
);
const upsertStmt = db.prepare<{ chatId: number; sessionId: string | null }>(`
  INSERT INTO chats (chat_id, session_id, updated_at)
  VALUES (@chatId, @sessionId, datetime('now'))
  ON CONFLICT(chat_id) DO UPDATE SET session_id = @sessionId, updated_at = datetime('now')
`);

export function getSessionId(chatId: number): string | null {
  const row = getStmt.get({ chatId }) as { sessionId: string | null } | undefined;
  return row?.sessionId ?? null;
}

export function saveSessionId(chatId: number, sessionId: string | null): void {
  upsertStmt.run({ chatId, sessionId });
}
