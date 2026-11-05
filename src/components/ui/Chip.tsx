import { cx } from "./cx";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

export type ChipTone = "constraint" | "pref" | "optional" | "place";

const TONES: Record<ChipTone, string> = {
  constraint: "bg-constraint-bg text-constraint-fg",
  pref: "bg-pref-bg text-pref-fg",
  optional: "bg-optional-bg text-optional-fg",
  place: "bg-place-bg text-place-fg",
};

export interface ChipProps {
  label: string;
  tone: ChipTone;
  inferred?: boolean;
  /** Small uppercase note after the label, e.g. "no data". */
  note?: string;
  highlighted?: boolean;
  /** Shows a ✕ button when provided. */
  onRemove?: () => void;
  removeLabel?: string;
}

export function Chip({ label, tone, inferred, note, highlighted, onRemove, removeLabel }: ChipProps) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-md border-[1.5px] text-[13px] font-medium transition-shadow duration-500",
        onRemove ? "pr-0.5 pl-2.5" : "px-2.5",
        inferred ? "border-dashed border-inferred-border bg-inferred-bg text-inferred-fg" : cx("border-transparent", TONES[tone]),
        highlighted && "shadow-[0_0_0_3px_var(--color-accent-ring)]",
      )}
    >
      {label}
      {inferred && <span className="font-mono text-[10px] tracking-wider text-inferred-tag uppercase">inferred</span>}
      {note && <span className="font-mono text-[10px] tracking-wider uppercase opacity-90">{note}</span>}
      {onRemove && (
        <IconButton aria-label={removeLabel ?? `Remove ${label}`} onClick={onRemove}>
          <CloseIcon size={12} />
        </IconButton>
      )}
    </span>
  );
}
