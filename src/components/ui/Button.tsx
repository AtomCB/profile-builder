import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "danger-outline" | "on-dark";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong border border-transparent",
  secondary: "bg-white text-ink border-[1.5px] border-field hover:bg-surface",
  "danger-outline": "bg-white text-accent-strong border-[1.5px] border-accent hover:bg-place-bg",
  "on-dark": "bg-transparent text-white border-[1.5px] border-accent-bright hover:bg-white/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] rounded-lg gap-1.5",
  md: "h-11 px-3.5 text-sm rounded-[10px] gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "secondary", size = "md", type = "button", className, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    />
  );
}
