"use client";

import { useState } from "react";
import { cx } from "@/components/ui/cx";

const base =
  "h-8 cursor-pointer rounded-lg border-[1.5px] px-3 font-sans text-[13px] font-semibold normal-case tracking-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Two-step "Start over" control for the dark header: click, then confirm. */
export function StartOverButton({ disabled, onConfirm }: { disabled: boolean; onConfirm: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setConfirming(true)}
        title={disabled ? "Wait for the reply to finish" : undefined}
        className={cx(base, "border-white/30 bg-transparent text-white hover:bg-white/10")}
      >
        Start over
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 font-sans text-[13px] tracking-normal text-white normal-case">
      Clear chat and profile?
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
        className={cx(base, "border-transparent bg-accent-bright text-brand-900 hover:bg-white")}
      >
        {busy ? "Clearing…" : "Yes, start over"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(false)}
        className={cx(base, "border-white/30 bg-transparent text-white hover:bg-white/10")}
      >
        Cancel
      </button>
    </span>
  );
}
