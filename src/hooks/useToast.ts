"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ToastData } from "@/components/ui/feedback";

const AUTO_DISMISS_MS = 6000;

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const nextId = useRef(1);

  const show = useCallback((message: string, action?: ToastData["action"]) => {
    setToast({ id: nextId.current++, message, action });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, show, dismiss };
}
