import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      "flex w-full rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
