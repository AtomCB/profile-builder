"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { IconButton } from "@/components/ui/IconButton";
import { SendIcon, StopIcon } from "@/components/ui/icons";

interface ComposerProps {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ streaming, onSend, onStop }: ComposerProps) {
  const [text, setText] = useState("");

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (streaming || !text.trim()) return;
    onSend(text);
    setText("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };

  return (
    <div className="flex flex-none flex-col items-center border-t border-line pt-4 pb-6">
      <form
        onSubmit={submit}
        className={cx(
          "flex w-[720px] items-center gap-2.5 rounded-xl border-[1.5px] py-2 pr-2 pl-4",
          streaming
            ? "border-line-soft bg-surface"
            : "border-field bg-white focus-within:border-brand-700 focus-within:shadow-[0_0_0_4px_var(--color-brand-100)]",
        )}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={streaming ? "Assistant is replying…" : "Type your answer…"}
          disabled={streaming}
          rows={1}
          maxLength={4000}
          autoFocus
          className="h-11 flex-1 resize-none bg-transparent py-2.5 text-ink outline-none placeholder:text-subtle disabled:text-subtle"
        />
        {streaming ? (
          <Button variant="danger-outline" onClick={onStop}>
            <StopIcon size={14} />
            Stop
          </Button>
        ) : (
          <IconButton type="submit" aria-label="Send message" variant="primary" size="lg" disabled={!text.trim()}>
            <SendIcon />
          </IconButton>
        )}
      </form>
      <div className="mt-2.5 w-[720px] text-xs text-subtle">
        {streaming ? "Profile updates appear on the right as the reply streams." : "Enter to send · Shift+Enter for a new line"}
      </div>
    </div>
  );
}
