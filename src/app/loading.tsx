import { AppHeader } from "@/components/AppHeader";
import { Skeleton, Spinner } from "@/components/ui/feedback";

const PROFILE_ROWS = [
  [110, 130],
  [80, 60],
  [130, 90],
  [120, 100],
  [100, 80],
  [70, 110],
  [110, 150],
  [60, 90],
  [80, 200],
];

export default function Loading() {
  return (
    <div className="flex h-screen flex-col" aria-busy="true">
      <AppHeader
        progress={
          <>
            <Skeleton onDark className="h-3 w-[120px]" />
            <Skeleton onDark className="h-2 w-[180px]" />
          </>
        }
      />
      <div className="flex min-h-0 flex-1">
        <main className="flex flex-1 flex-col">
          <div className="mx-auto flex w-[720px] flex-1 flex-col gap-7 py-9">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-3.5 w-[560px]" />
              <Skeleton className="h-3.5 w-[480px]" />
              <Skeleton className="h-3.5 w-[320px]" />
            </div>
            <Skeleton className="h-12 w-[380px] self-end rounded-[14px_14px_4px_14px]" />
            <div role="status" className="flex items-center justify-center gap-2.5 text-[13px] text-muted">
              <Spinner />
              Loading your profile and conversation…
            </div>
          </div>
          <div className="flex justify-center border-t border-line pt-4 pb-6">
            <div className="h-[62px] w-[720px] rounded-xl border-[1.5px] border-line bg-surface" />
          </div>
        </main>
        <aside className="flex w-[440px] flex-none flex-col gap-3.5 border-l border-line bg-surface px-7 pt-7">
          {PROFILE_ROWS.map(([a, b], i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <Skeleton className="h-3" width={a} />
              <Skeleton className="h-6" width={b} />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
