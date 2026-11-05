import { ApiError } from "@google/genai";
import type { ChatError } from "@/lib/chat/types";
import { getModelChain, MissingApiKeyError } from "./client";

/** Maps any thrown error to a user-facing ChatError, with raw details in development. */
export function toChatError(err: unknown): ChatError {
  const error = classify(err);
  if (process.env.NODE_ENV === "development") {
    const status = err instanceof ApiError ? `${err.status} ` : "";
    const message = err instanceof Error ? err.message : String(err);
    error.detail = `${status}${message}`.slice(0, 600);
  }
  return error;
}

function classify(err: unknown): ChatError {
  if (err instanceof MissingApiKeyError) {
    return {
      code: "invalid_key",
      error: "The Gemini API key is missing. Add GEMINI_API_KEY to .env and restart the server.",
      retryable: false,
    };
  }

  const status = err instanceof ApiError ? err.status : undefined;
  const text = err instanceof Error ? err.message : String(err);

  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(text)) {
    return {
      code: "rate_limited",
      error: "The free-tier rate limit was reached. Wait about a minute, then try again.",
      retryable: true,
    };
  }
  if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test(text)) {
    return {
      code: "invalid_key",
      error: "The Gemini API key was rejected. Check GEMINI_API_KEY in .env and restart the server.",
      retryable: false,
    };
  }
  if (status === 404 || /not found|is not supported/i.test(text)) {
    return {
      code: "model_not_found",
      error: `None of the configured models (${getModelChain().join(", ")}) are available for this API key. Set GEMINI_MODEL in .env.local to a model you can use and restart.`,
      retryable: false,
    };
  }
  if (status === 503 || /overloaded|high demand|UNAVAILABLE/i.test(text)) {
    return {
      code: "model_error",
      error: "Gemini is under heavy demand right now (all fallback models included). Wait a minute, then try again.",
      retryable: true,
    };
  }
  if (status !== undefined && status >= 500) {
    return { code: "model_error", error: "The model service had a problem. Try again in a moment.", retryable: true };
  }
  if (status === 400) {
    return { code: "bad_request", error: "The model couldn't process that request. Try rephrasing.", retryable: true };
  }
  return { code: "internal", error: "Something went wrong. Try again.", retryable: true };
}
