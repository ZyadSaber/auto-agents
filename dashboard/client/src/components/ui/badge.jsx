import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-brand-500/10 text-brand-400 border-brand-500/20",
        secondary:   "bg-slate-700/50 text-slate-300 border-slate-600/30",
        success:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        warning:     "bg-amber-500/10 text-amber-400 border-amber-500/20",
        destructive: "bg-red-500/10 text-red-400 border-red-500/20",
        outline:     "text-slate-300 border-slate-600/50",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
