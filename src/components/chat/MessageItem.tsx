import type { UiMessage } from "@/hooks/useChat";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Alert } from "@/components/ui/feedback";
import { RetryIcon, SearchIcon } from "@/components/ui/icons";
import type { ToolEvent } from "@/lib/chat/types";
import type { ProfileChange } from "@/lib/profile/changes";

export function MessageItem({ message, isLast, onRetry }: { message: UiMessage; isLast: boolean; onRetry: () => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[520px] rounded-[14px_14px_4px_14px] bg-brand-700 px-4 py-3 whitespace-pre-wrap text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const waiting = message.streaming && !message.content && message.tools.length === 0;
  const showProfileNote = message.error && message.error.code !== "invalid_key" && message.error.code !== "model_not_found";

  return (
    <div className="max-w-[620px]">
      <div className="mb-1.5 font-mono text-[11px] font-medium tracking-[0.08em] text-brand-700 uppercase">Assistant</div>
      {message.tools.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {dedupeTools(message.tools).map((t, i) => (
            <ToolBadge key={i} tool={t} />
          ))}
        </div>
      )}
      {waiting && <span className="text-subtle">Thinking…</span>}
      {message.content && (
        <div className="whitespace-pre-wrap">
          {message.content}
          {message.streaming && (
            <span aria-hidden="true" className="ml-0.5 inline-block h-[17px] w-2 animate-blink bg-accent align-[-3px]" />
          )}
        </div>
      )}
      {message.changes.length > 0 && <ProfileChanges changes={message.changes} />}
      {message.status === "interrupted" && <div className="mt-1 text-[13px] text-subtle italic">Stopped.</div>}
      {message.error && (
        <Alert
          title="Reply interrupted"
          action={
            isLast && message.error.retryable ? (
              <Button size="sm" onClick={onRetry}>
                <RetryIcon size={14} />
                Retry
              </Button>
            ) : undefined
          }
        >
          {message.error.error}
          {showProfileNote && " Nothing in your profile was lost."}
          {message.error.detail && (
            <code className="mt-2 block font-mono text-xs break-words whitespace-pre-wrap opacity-80">
              {message.error.detail}
            </code>
          )}
        </Alert>
      )}
    </div>
  );
}

const CHANGE_STYLES: Record<ProfileChange["kind"], { symbol: string; word: string; className: string }> = {
  added: { symbol: "+", word: "Added", className: "text-pref-fg" },
  updated: { symbol: "→", word: "Updated", className: "text-brand-700" },
  confirmed: { symbol: "✓", word: "Confirmed", className: "text-pref-fg" },
  removed: { symbol: "−", word: "Removed", className: "text-accent-strong" },
};

/** Server-computed summary of what this turn changed in the profile. */
export function ProfileChanges({ changes }: { changes: ProfileChange[] }) {
  return (
    <div className="mt-3 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[13px]">
      <div className="mb-1 font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Profile updated</div>
      <ul className="flex flex-col gap-0.5">
        {changes.map((c, i) => {
          const style = CHANGE_STYLES[c.kind];
          return (
            <li key={i} className="flex items-baseline gap-2">
              <span aria-hidden="true" className={cx("w-3 font-mono font-medium", style.className)}>
                {style.symbol}
              </span>
              <span>
                <span className="sr-only">{style.word} </span>
                <span className="text-muted">{c.field}:</span> {c.value}
                {c.kind === "removed" && <span className="text-subtle"> (removed)</span>}
                {c.kind === "confirmed" && <span className="text-subtle"> (confirmed)</span>}
                {c.inferred && (
                  <span className="ml-1.5 font-mono text-[10px] tracking-wider text-inferred-tag uppercase">inferred</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Profile updates can happen several times per turn; show one badge for each distinct tool use. */
function dedupeTools(tools: ToolEvent[]): ToolEvent[] {
  const seen = new Set<string>();
  return tools.filter((t) => {
    const key = `${t.name}:${t.arg ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ToolBadge({ tool }: { tool: ToolEvent }) {
  const unknown = tool.name === "getDestinationInfo" && tool.found === false;
  const label =
    tool.name === "getDestinationInfo" ? `Looked up ${tool.arg ?? "destination"}${unknown ? " · no data" : ""}` : "Updated profile";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 font-mono text-xs",
        unknown ? "bg-neutral-chip text-muted" : "bg-pref-bg text-pref-fg",
      )}
    >
      <SearchIcon size={13} />
      {label}
    </span>
  );
}
