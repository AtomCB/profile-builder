import { z } from "zod";
import {
  toolEventSchema,
  type ChatMessage,
  type MessageRole,
  type MessageStatus,
  type ToolEvent,
} from "@/lib/chat/types";
import { getDb, type Db } from "./index";

export type { ChatMessage, MessageRole, MessageStatus, ToolEvent };

export interface NewMessage {
  role: MessageRole;
  content: string;
  tools?: ToolEvent[];
  status?: MessageStatus;
}

interface Row {
  id: string;
  role: MessageRole;
  content: string;
  tools: string;
  status: MessageStatus;
  created_at: string;
}

const COLUMNS = "id, role, content, tools, status, created_at";

function parseTools(json: string): ToolEvent[] {
  try {
    const parsed = z.array(toolEventSchema).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function toMessage(row: Row): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    tools: parseTools(row.tools),
    status: row.status,
    createdAt: row.created_at,
  };
}

export function insertMessage(input: NewMessage, db: Db = getDb()): ChatMessage {
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    role: input.role,
    content: input.content,
    tools: input.tools ?? [],
    status: input.status ?? "complete",
    createdAt: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO messages (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`).run(
    message.id,
    message.role,
    message.content,
    JSON.stringify(message.tools),
    message.status,
    message.createdAt,
  );
  return message;
}

/** All messages, oldest first (capped as a safety net). */
export function listMessages(db: Db = getDb(), limit = 500): ChatMessage[] {
  const rows = db.prepare(`SELECT ${COLUMNS} FROM messages ORDER BY seq ASC LIMIT ?`).all(limit) as unknown as Row[];
  return rows.map(toMessage);
}

/** The most recent `count` messages, oldest first. */
export function listRecentMessages(count: number, db: Db = getDb()): ChatMessage[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM messages ORDER BY seq DESC LIMIT ?`)
    .all(count) as unknown as Row[];
  return rows.reverse().map(toMessage);
}

export function getLastMessage(db: Db = getDb()): ChatMessage | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM messages ORDER BY seq DESC LIMIT 1`).get() as Row | undefined;
  return row ? toMessage(row) : null;
}

/** Deletes all chat history. */
export function clearMessages(db: Db = getDb()): void {
  db.prepare("DELETE FROM messages").run();
}

/** Used when retrying: removes the failed assistant reply being replaced. */
export function deleteMessage(id: string, db: Db = getDb()): boolean {
  return db.prepare("DELETE FROM messages WHERE id = ?").run(id).changes > 0;
}
