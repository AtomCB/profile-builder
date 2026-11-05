import type { ReactNode } from "react";
import { Button } from "./Button";
import { cx } from "./cx";
import { AlertIcon } from "./icons";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-700", className)}
    />
  );
}

export function Skeleton({ className, onDark, width }: { className?: string; onDark?: boolean; width?: number }) {
  return (
    <span
      aria-hidden="true"
      style={width ? { width } : undefined}
      className={cx("block animate-pulse rounded-md", onDark ? "bg-white/20" : "bg-line", className)}
    />
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="block h-2 w-[180px] overflow-hidden rounded bg-white/20"
    >
      <span className="block h-full bg-accent-bright transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function Alert({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="alert"
      className="mt-3 flex items-start gap-3 rounded-[10px] border border-danger-border bg-danger-bg px-3.5 py-3 text-danger-fg"
    >
      <AlertIcon size={20} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <b className="block font-semibold text-danger-title">{title}</b>
        {children}
      </div>
      {action}
    </div>
  );
}

export interface ToastData {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      role="alert"
      className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-[10px] bg-brand-900 py-2 pr-2 pl-3.5 text-sm text-white shadow-[0_8px_24px_rgba(38,33,92,0.25)]"
    >
      {toast.message}
      {toast.action && (
        <Button
          variant="on-dark"
          size="sm"
          onClick={() => {
            onDismiss();
            toast.action!.onClick();
          }}
        >
          {toast.action.label}
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="cursor-pointer px-1 text-brand-on-dark hover:text-white"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
