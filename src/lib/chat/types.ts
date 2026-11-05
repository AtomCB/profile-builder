import { z } from "zod";
import type { ProfileChange } from "@/lib/profile/changes";
import type { Completeness } from "@/lib/profile/completeness";
import type { UserProfile } from "@/lib/profile/schema";

export const toolEventSchema = z.object({
  name: z.enum(["getDestinationInfo", "updateProfile"]),
  /** For getDestinationInfo: the place name asked about. */
  arg: z.string().optional(),
  /** For getDestinationInfo: whether the destination was known. */
  found: z.boolean().optional(),
});

export type ToolEvent = z.infer<typeof toolEventSchema>;
export type MessageRole = "user" | "assistant";
export type MessageStatus = "complete" | "interrupted" | "error";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  tools: ToolEvent[];
  /** Profile changes made during this assistant turn, computed by the server. */
  changes: ProfileChange[];
  status: MessageStatus;
  createdAt: string;
}

export type ChatErrorCode =
  | "rate_limited"
  | "invalid_key"
  | "model_not_found"
  | "model_error"
  | "bad_request"
  | "network"
  | "internal";

export interface ChatError {
  code: ChatErrorCode;
  error: string;
  retryable: boolean;
  /** Raw provider error (development only), to make debugging possible from the UI. */
  detail?: string;
}

export interface ProfileSnapshot {
  profile: UserProfile;
  completeness: Completeness;
}

/** Events streamed from POST /api/chat. */
export type ServerEvent =
  | { event: "token"; data: { text: string } }
  | { event: "tool"; data: ToolEvent }
  | { event: "profile"; data: ProfileSnapshot }
  | { event: "done"; data: { message: ChatMessage } }
  | { event: "error"; data: ChatError & { message?: ChatMessage } };

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  /** The opening message the client displayed; persisted before the first user message of a session. */
  opening: z.string().trim().min(1).max(2000).optional(),
  /** Re-run the agent for the last user message instead of storing a new one. */
  retry: z.boolean().optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;
