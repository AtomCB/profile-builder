"use client";

import { useEffect, useRef, type RefObject } from "react";

const NEAR_BOTTOM_PX = 120;

/** Keeps a scroll container pinned to the bottom when content changes, unless the user scrolled up. */
export function useAutoScroll<T extends HTMLElement>(ref: RefObject<T | null>, dependency: unknown) {
  const pinned = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [ref, dependency]);
}
