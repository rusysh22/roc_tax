import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * SerenTax logo rendered as a CSS mask so it takes `currentColor`: white on
 * the black navbar, black in light theme, white in dark theme — from one
 * asset. Sources live in /static and are regenerated with
 * `node scripts/generate-brand-assets.mjs`.
 */
const assets = {
  full: { src: "/brand/serentax-logo.png", ratio: 643 / 185 },
  mark: { src: "/brand/serentax-mark.png", ratio: 160 / 185 },
} as const;

export function BrandLogo({
  variant = "full",
  className,
  label = "SerenTax",
}: {
  variant?: keyof typeof assets;
  /** Set the height (e.g. `h-6`); the width follows the logo ratio. */
  className?: string;
  label?: string;
}) {
  const asset = assets[variant];
  const mask = `url(${asset.src}) center / contain no-repeat`;
  const style: CSSProperties = {
    aspectRatio: String(asset.ratio),
    mask,
    WebkitMask: mask,
  };
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-block h-6 shrink-0 bg-current", className)}
      style={style}
    />
  );
}
