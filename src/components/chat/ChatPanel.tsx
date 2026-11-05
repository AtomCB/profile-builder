"use client";

import { useRef } from "react";
import type { ChatStatus, UiMessage } from "@/hooks/useChat";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { Composer } from "./Composer";
import { MessageItem } from "./MessageItem";

interface ChatPanelProps {
  messages: UiMessage[];
  status: ChatStatus;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
}

export function ChatPanel({ messages, status, onSend, onStop, onRetry }: ChatPanelProps) {
  const threadRef = useRef<HTMLDivElement>(null);
  const last = messages.at(-1);
  useAutoScroll(threadRef, `${messages.length}:${last?.content.length}:${last?.tools.length}`);

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-8" aria-live="polite">
        <div className="mx-auto flex w-[720px] flex-col gap-5">
          {messages.map((m) => (
            <MessageItem key={m.id} message={m} isLast={m === last} onRetry={onRetry} />
          ))}
        </div>
      </div>
      <Composer streaming={status === "streaming"} onSend={onSend} onStop={onStop} />
    </main>
  );
}
