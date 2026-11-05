import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  "aria-label": string;
  variant?: "primary" | "ghost";
  size?: "sm" | "lg";
}

export function IconButton({ variant = "ghost", size = "sm", type = "button", className, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex shrink-0 cursor-pointer items-center justify-center transition-colors disabled:cursor-not-allowed",
        size === "lg" ? "h-11 w-11 rounded-[10px]" : "h-6 w-6 rounded",
        variant === "primary"
          ? "bg-accent text-white hover:bg-accent-strong disabled:bg-line disabled:text-subtle"
          : "bg-transparent text-current hover:bg-black/5",
        className,
      )}
      {...rest}
    />
  );
}
