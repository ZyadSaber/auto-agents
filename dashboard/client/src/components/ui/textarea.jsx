import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-xl bg-slate-950/50 border border-slate-700 text-slate-100 placeholder-slate-500 px-3 py-2 text-sm",
      "focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all",
      "disabled:cursor-not-allowed disabled:opacity-50 resize-none",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
