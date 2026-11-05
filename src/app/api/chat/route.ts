import { chatRequestSchema, type ServerEvent, type ToolEvent } from "@/lib/chat/types";
import { deleteMessage, getLastMessage, insertMessage, listRecentMessages } from "@/lib/db/messageRepo";
import { applyProfileOps, loadProfile } from "@/lib/db/profileRepo";
import { toChatError } from "@/lib/llm/errors";
import { geminiGenerate } from "@/lib/llm/gemini";
import { runAgent } from "@/lib/llm/runAgent";
import { describeChanges } from "@/lib/profile/changes";
import { encodeSse } from "@/lib/sse/encode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HISTORY_LIMIT = 20;
const EMPTY_REPLY = "Sorry, I didn't catch that. Could you say it another way?";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { message, opening, retry } = parsed.data;

  // Persist the turn before streaming so a reload mid-reply keeps the user's message.
  const last = getLastMessage();
  if (retry) {
    if (last?.role === "assistant" && last.status !== "complete") deleteMessage(last.id);
    const now = getLastMessage();
    if (now?.role !== "user" || now.content !== message) insertMessage({ role: "user", content: message });
  } else {
    if (opening && last?.content !== opening) insertMessage({ role: "assistant", content: opening });
    insertMessage({ role: "user", content: message });
  }
  const history = listRecentMessages(HISTORY_LIMIT);
  const profileBefore = loadProfile();
  // The change summary is computed from the actual before/after profiles, never from model text.
  const changesSoFar = () => describeChanges(profileBefore, loadProfile());

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = <E extends ServerEvent>(event: E["event"], data: E["data"]) => {
        try {
          controller.enqueue(encoder.encode(encodeSse(event, data)));
        } catch {
          // Client disconnected; keep going so the reply is still saved.
        }
      };

      let text = "";
      const tools: ToolEvent[] = [];
      try {
        for await (const ev of runAgent({
          history,
          signal: request.signal,
          deps: { generate: geminiGenerate, loadProfile, applyProfileOps },
        })) {
          if (ev.type === "token") {
            text += ev.text;
            send("token", { text: ev.text });
          } else if (ev.type === "tool") {
            tools.push(ev.tool);
            send("tool", ev.tool);
          } else {
            send("profile", ev.snapshot);
          }
        }
        const saved = insertMessage({
          role: "assistant",
          content: text.trim() || EMPTY_REPLY,
          tools,
          changes: changesSoFar(),
        });
        send("done", { message: saved });
      } catch (err) {
        if (request.signal.aborted) {
          if (text.trim() || tools.length || changesSoFar().length) {
            insertMessage({ role: "assistant", content: text.trim(), tools, changes: changesSoFar(), status: "interrupted" });
          }
        } else {
          console.error("[chat] agent failed:", err instanceof Error ? `${err.name}: ${err.message}` : err);
          const error = toChatError(err);
          const saved = insertMessage({
            role: "assistant",
            content: text.trim(),
            tools,
            changes: changesSoFar(),
            status: "error",
          });
          send("error", { ...error, message: saved });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
