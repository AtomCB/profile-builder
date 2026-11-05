"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatError, ChatMessage, ChatRequest, ProfileSnapshot, ServerEvent } from "@/lib/chat/types";
import { createSseParser } from "@/lib/sse/parse";

export interface UiMessage extends ChatMessage {
  streaming?: boolean;
  error?: ChatError;
}

export type ChatStatus = "idle" | "streaming";

const NETWORK_ERROR: ChatError = {
  code: "network",
  error: "Couldn't reach the server. Check that it's running, then try again.",
  retryable: true,
};

const OPENING_ID = "opening";

function localMessage(role: ChatMessage["role"], content: string, id: string = crypto.randomUUID()): UiMessage {
  return { id, role, content, tools: [], changes: [], status: "complete", createdAt: new Date().toISOString() };
}

/**
 * Chat state and the streaming POST /api/chat lifecycle: send, stop, retry.
 * Profile snapshots from the stream are forwarded to onProfile.
 */
export function useChat(opts: {
  initialMessages: ChatMessage[];
  opening: string;
  onProfile: (snapshot: ProfileSnapshot) => void;
}) {
  const [messages, setMessages] = useState<UiMessage[]>(() => [
    ...opts.initialMessages.map((m): UiMessage =>
      m.status === "error"
        ? { ...m, error: { code: "internal", error: "This reply didn't finish.", retryable: true } }
        : m,
    ),
    localMessage("assistant", opts.opening, OPENING_ID),
  ]);
  const [status, setStatus] = useState<ChatStatus>("idle");

  const abortRef = useRef<AbortController | null>(null);
  const openingPending = useRef(true);
  const onProfileRef = useRef(opts.onProfile);
  onProfileRef.current = opts.onProfile;

  const stream = useCallback(async (body: ChatRequest) => {
    const draftId = `draft-${crypto.randomUUID()}`;
    setMessages((ms) => [...ms, { ...localMessage("assistant", "", draftId), streaming: true }]);
    setStatus("streaming");

    const controller = new AbortController();
    abortRef.current = controller;
    const update = (fn: (m: UiMessage) => UiMessage) =>
      setMessages((ms) => ms.map((m) => (m.id === draftId ? fn(m) : m)));

    let finished = false;
    const fail = (error: ChatError, saved?: ChatMessage) => {
      finished = true;
      update((m) => ({ ...m, ...saved, status: "error", streaming: false, error }));
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        fail({ code: "bad_request", error: "The server couldn't accept that message.", retryable: true });
        return;
      }

      const parser = createSseParser(({ event, data }) => {
        const e = { event, data: JSON.parse(data) } as ServerEvent;
        switch (e.event) {
          case "token":
            update((m) => ({ ...m, content: m.content + e.data.text }));
            break;
          case "tool":
            update((m) => ({ ...m, tools: [...m.tools, e.data] }));
            break;
          case "profile":
            onProfileRef.current(e.data);
            break;
          case "done":
            finished = true;
            update(() => ({ ...e.data.message, streaming: false }));
            break;
          case "error": {
            const { message: saved, ...error } = e.data;
            fail(error, saved);
            break;
          }
        }
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.push(value);
      }
      parser.flush();
      if (!finished) fail(NETWORK_ERROR);
    } catch {
      if (controller.signal.aborted) {
        setMessages((ms) =>
          ms.flatMap((m) => {
            if (m.id !== draftId) return [m];
            return m.content || m.tools.length ? [{ ...m, streaming: false, status: "interrupted" as const }] : [];
          }),
        );
      } else {
        fail(NETWORK_ERROR);
      }
    } finally {
      abortRef.current = null;
      setStatus("idle");
    }
  }, []);

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || abortRef.current) return;
      const body: ChatRequest = { message };
      if (openingPending.current) {
        body.opening = opts.opening;
        openingPending.current = false;
      }
      setMessages((ms) => [...ms, localMessage("user", message)]);
      void stream(body);
    },
    [opts.opening, stream],
  );

  const retry = useCallback(() => {
    if (abortRef.current) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Drop the failed reply(s) after the last user message.
    setMessages((ms) => {
      const idx = ms.lastIndexOf(lastUser);
      return ms.filter((m, i) => i <= idx || m.status === "complete");
    });
    void stream({ message: lastUser.content, retry: true });
  }, [messages, stream]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { messages, status, send, retry, stop };
}
