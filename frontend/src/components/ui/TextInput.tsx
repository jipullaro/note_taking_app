import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// ComponentProps<"input"> rather than InputHTMLAttributes so `ref` is part of
// the props too (React 19 passes it as an ordinary prop) — the search field
// needs one to keep focus after clearing.
export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-accent/60 bg-cream px-4 py-3 text-ink placeholder:text-ink/50 outline-none focus:border-accent",
        className
      )}
      {...props}
    />
  );
}
