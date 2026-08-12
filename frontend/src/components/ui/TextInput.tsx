import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

interface TextInputProps extends ComponentProps<"input"> {
  /** "box" is the form field (auth screens); "pill" matches the outline
   * Button's rounding and height, for sitting beside one in a toolbar. */
  shape?: "box" | "pill";
}

// ComponentProps<"input"> rather than InputHTMLAttributes so `ref` is part of
// the props too (React 19 passes it as an ordinary prop) — the search field
// needs one to keep focus after clearing.
//
// Rounding and vertical padding are a prop rather than something the caller
// overrides through className: `cn` is a plain joiner, so a conflicting
// utility doesn't win — the two rules just race, and Tailwind's own output
// order decides. Only classes the base doesn't set are safe to pass in.
export function TextInput({ className, shape = "box", ...props }: TextInputProps) {
  return (
    <input
      className={cn(
        "w-full border border-accent/60 bg-cream px-4 text-ink placeholder:text-ink/50 outline-none focus:border-accent",
        shape === "box" && "rounded-lg py-3",
        // py-2.5 + the 1px border is exactly the outline Button's height, so
        // the two line up when they share a row.
        shape === "pill" && "rounded-full py-2.5",
        className
      )}
      {...props}
    />
  );
}
