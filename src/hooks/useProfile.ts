"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileSnapshot } from "@/lib/chat/types";
import { getCompleteness } from "@/lib/profile/completeness";
import { changedKeys } from "@/lib/profile/format";
import type { RejectOp } from "@/lib/profile/ops";
import { applyOps } from "@/lib/profile/reducer";

const HIGHLIGHT_MS = 3000;

/**
 * Holds the profile shown in the ledger. Server snapshots (from the chat stream)
 * replace it; rejections are applied optimistically and rolled back on failure.
 */
export function useProfile(initial: ProfileSnapshot, onRejectFailed: (label: string, retry: () => void) => void) {
  const [snapshot, setSnapshot] = useState(initial);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const current = useRef(snapshot);
  current.current = snapshot;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const highlight = useCallback((keys: string[]) => {
    if (keys.length === 0) return;
    setHighlighted(new Set(keys));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlighted(new Set()), HIGHLIGHT_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const applyServerSnapshot = useCallback(
    (next: ProfileSnapshot) => {
      highlight(changedKeys(current.current.profile, next.profile));
      setSnapshot(next);
    },
    [highlight],
  );

  const reject = useCallback(
    async (op: RejectOp, label: string) => {
      const before = current.current;
      const optimistic = applyOps(before.profile, [op]);
      if (!optimistic.changed) return;
      setSnapshot({ profile: optimistic.profile, completeness: getCompleteness(optimistic.profile) });

      const retry = () => void reject(op, label);
      try {
        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ops: [op] }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSnapshot((await res.json()) as ProfileSnapshot);
      } catch {
        setSnapshot(before);
        onRejectFailed(label, retry);
      }
    },
    [onRejectFailed],
  );

  return { ...snapshot, highlighted, applyServerSnapshot, reject };
}
