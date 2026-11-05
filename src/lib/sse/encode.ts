import type { ServerEvent } from "@/lib/chat/types";

/** Formats one Server-Sent Event frame. */
export function encodeSse<E extends ServerEvent>(event: E["event"], data: E["data"]): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
