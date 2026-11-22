import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] select-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Primary action (blue). */
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 active:bg-primary/80",
        outline:
          "border border-border-strong bg-surface text-foreground shadow-xs hover:border-foreground/40 hover:bg-surface-2 active:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-accent active:bg-accent",
        ghost: "text-foreground hover:bg-muted active:bg-accent",
        link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
        /** Approve / confirm a positive outcome (green). */
        success:
          "bg-success text-white shadow-xs hover:bg-success/90 active:bg-success/80",
        /** Send back / needs attention (amber). */
        warning:
          "bg-warning text-white shadow-xs hover:bg-warning/90 active:bg-warning/80",
        /** Destructive: delete, void, revoke (red). */
        danger:
          "bg-danger text-white shadow-xs hover:bg-danger/90 active:bg-danger/80",
        /** Brand dark (neutral emphasis). */
        dark: "bg-foreground text-background shadow-xs hover:bg-foreground/85",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem] pointer-coarse:min-h-10",
        default: "h-9 px-4 pointer-coarse:min-h-11",
        lg: "h-11 px-5 text-[0.9375rem]",
        icon: "size-9 pointer-coarse:size-11",
        "icon-sm": "size-8 pointer-coarse:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
