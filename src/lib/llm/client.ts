import { GoogleGenAI } from "@google/genai";

export const DEFAULT_MODEL = "gemini-3.6-flash";

/** Tried in order after the configured model when it's overloaded, rate-limited or unavailable. */
export const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

export class MissingApiKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set");
  }
}

export function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** The configured model followed by the fallbacks, without duplicates. */
export function getModelChain(): string[] {
  return [...new Set([getModelName(), ...FALLBACK_MODELS])];
}

const globalForAi = globalThis as unknown as { __genai?: { key: string; client: GoogleGenAI } };

/** Server-only Gemini client. Throws MissingApiKeyError if the key isn't configured. */
export function getGenAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new MissingApiKeyError();
  if (globalForAi.__genai?.key !== key) {
    globalForAi.__genai = { key, client: new GoogleGenAI({ apiKey: key }) };
  }
  return globalForAi.__genai.client;
}
