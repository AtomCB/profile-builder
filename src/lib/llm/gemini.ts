import { ApiError, FunctionCallingConfigMode, type GenerateContentParameters } from "@google/genai";
import { getGenAI, getModelChain } from "./client";
import type { GenerateStream } from "./runAgent";

/** Worth retrying the same model once (transient server trouble). */
const RETRY_STATUSES = new Set([500, 502, 503, 504]);
/** Worth moving on to the next model: overloaded, rate-limited, or not available to this key. */
const FALLBACK_STATUSES = new Set([404, 429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 800;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });

// The model that last worked is tried first, so one turn (and its thought signatures)
// stays on a single model, and we don't keep hitting an overloaded one.
const globalForModel = globalThis as unknown as { __lastGoodModel?: string };

function orderedModels(): string[] {
  const chain = getModelChain();
  const last = globalForModel.__lastGoodModel;
  return last && chain.includes(last) ? [last, ...chain.filter((m) => m !== last)] : chain;
}

/**
 * The real Gemini streaming call used by runAgent. Errors before the stream starts
 * are retried once on the same model, then the next model in the chain is tried.
 */
export const geminiGenerate: GenerateStream = async ({ contents, config }) => {
  const baseConfig = {
    systemInstruction: config.systemInstruction,
    tools: config.tools,
    abortSignal: config.abortSignal,
    toolConfig: config.toolConfig
      ? { functionCallingConfig: { mode: FunctionCallingConfigMode[config.toolConfig.functionCallingConfig.mode] } }
      : undefined,
  };

  let lastError: unknown;
  for (const model of orderedModels()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const params = { model, contents, config: baseConfig } as GenerateContentParameters;
        const stream = await getGenAI().models.generateContentStream(params);
        globalForModel.__lastGoodModel = model;
        return stream;
      } catch (err) {
        lastError = err;
        if (config.abortSignal?.aborted || !(err instanceof ApiError)) throw err;
        if (attempt === 0 && RETRY_STATUSES.has(err.status)) {
          console.warn(`[gemini] ${model} returned ${err.status}; retrying once`);
          await sleep(RETRY_DELAY_MS, config.abortSignal);
          continue;
        }
        if (!FALLBACK_STATUSES.has(err.status)) throw err;
        console.warn(`[gemini] ${model} returned ${err.status}; trying the next model`);
        break;
      }
    }
  }
  throw lastError;
};
