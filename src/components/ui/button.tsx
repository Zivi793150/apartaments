import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition will-change-transform duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 ring-brand/40 hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white shadow-sm hover:shadow-md hover:opacity-95",
        outline: "border border-border hover:bg-surface shadow-sm hover:shadow-md",
        ghost: "hover:bg-surface",
      },
      size: {
        sm: "h-9 px-4",
        md: "h-11 px-5",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
