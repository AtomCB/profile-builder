import type { ChatMessage, ProfileSnapshot, ToolEvent } from "@/lib/chat/types";
import { getCompleteness } from "@/lib/profile/completeness";
import type { ProfileOp } from "@/lib/profile/ops";
import type { ApplyResult } from "@/lib/profile/reducer";
import type { UserProfile } from "@/lib/profile/schema";
import { buildSystemPrompt } from "./systemPrompt";
import { executeTool, FUNCTION_DECLARATIONS } from "./tools";

export const MAX_TOOL_ROUNDS = 5;

/** Minimal shapes of the Gemini API we rely on (kept loose so tests can fake them). */
export interface Part {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name?: string; args?: Record<string, unknown> };
  functionResponse?: { id?: string; name?: string; response?: Record<string, unknown> };
  /** Gemini 3 thought signature; must be sent back with the function call. */
  thoughtSignature?: string;
}
export interface Content {
  role: "user" | "model";
  parts: Part[];
}
export interface Chunk {
  candidates?: { content?: { parts?: Part[] } }[];
}
export interface GenerateRequest {
  contents: Content[];
  config: {
    systemInstruction: string;
    tools: { functionDeclarations: typeof FUNCTION_DECLARATIONS }[];
    toolConfig?: { functionCallingConfig: { mode: "NONE" | "AUTO" } };
    abortSignal?: AbortSignal;
  };
}
export type GenerateStream = (req: GenerateRequest) => Promise<AsyncIterable<Chunk>>;

export interface AgentDeps {
  generate: GenerateStream;
  loadProfile: () => UserProfile;
  applyProfileOps: (ops: readonly ProfileOp[]) => ApplyResult;
}

export type AgentEvent =
  | { type: "token"; text: string }
  | { type: "tool"; tool: ToolEvent }
  | { type: "profile"; snapshot: ProfileSnapshot };

/** Converts stored chat history to Gemini contents (skips failed replies, merges same-role turns). */
export function toContents(history: readonly ChatMessage[]): Content[] {
  const contents: Content[] = [];
  for (const m of history) {
    if (m.status === "error" || !m.content.trim()) continue;
    const role = m.role === "user" ? "user" : "model";
    const last = contents.at(-1);
    if (last?.role === role) last.parts[0].text = `${last.parts[0].text}\n\n${m.content}`;
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  // The API expects the conversation to start with a user turn.
  if (contents[0]?.role === "model") contents.unshift({ role: "user", parts: [{ text: "(session started)" }] });
  return contents;
}

/**
 * Runs one assistant turn: streams text, executes tool calls, feeds results back,
 * and repeats until the model answers with text only (max MAX_TOOL_ROUNDS tool rounds).
 */
export async function* runAgent(opts: {
  history: readonly ChatMessage[];
  deps: AgentDeps;
  signal?: AbortSignal;
}): AsyncGenerator<AgentEvent> {
  const { deps, signal } = opts;
  const contents = toContents(opts.history);

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const profile = deps.loadProfile();
    const stream = await deps.generate({
      contents,
      config: {
        systemInstruction: buildSystemPrompt(profile, getCompleteness(profile)),
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
        toolConfig: round === MAX_TOOL_ROUNDS ? { functionCallingConfig: { mode: "NONE" } } : undefined,
        abortSignal: signal,
      },
    });

    const modelParts: Part[] = [];
    const calls: NonNullable<Part["functionCall"]>[] = [];
    for await (const chunk of stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        // Keep every part (including thought signatures) to send back verbatim.
        modelParts.push(part);
        if (part.functionCall) calls.push(part.functionCall);
        else if (part.text && !part.thought) yield { type: "token", text: part.text };
      }
    }

    if (calls.length === 0) return;

    contents.push({ role: "model", parts: modelParts });
    const responses: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "";
      const outcome = executeTool(name, call.args ?? {}, deps);
      yield { type: "tool", tool: outcome.event };
      if (outcome.profile) yield { type: "profile", snapshot: outcome.profile };
      responses.push({ functionResponse: { id: call.id, name, response: outcome.response } });
    }
    contents.push({ role: "user", parts: responses });
  }
}
