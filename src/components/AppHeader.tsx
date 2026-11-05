import type { ReactNode } from "react";
import { ProgressBar } from "@/components/ui/feedback";
import { CompassIcon } from "@/components/ui/icons";

export function AppHeader({ progress, actions }: { progress: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex h-[60px] flex-none items-center justify-between bg-brand-900 px-7 text-white">
      <div className="flex items-center gap-2.5 text-base font-semibold">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-accent-bright text-brand-900">
          <CompassIcon strokeWidth={2.2} />
        </span>
        Profile Builder
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 font-mono text-xs tracking-[0.06em] text-brand-on-dark uppercase">
          {progress}
        </div>
        {actions}
      </div>
    </header>
  );
}

export function EssentialsProgress({ done, total }: { done: number; total: number }) {
  return (
    <>
      <span>
        {done} of {total} essentials
      </span>
      <ProgressBar value={done} max={total} label="Profile essentials completed" />
    </>
  );
}
